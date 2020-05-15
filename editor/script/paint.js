/*
	PAINT
*/

function PaintTool(canvas, roomTool) {
	var self = this; // feels a bit hacky

	var paint_scale = 32;
	var curPaintBrush = 0;
	var isPainting = false;
	this.isCurDrawingAnimated = false; // TODO eventually this can be internal
	this.curDrawingFrameIndex = 0; // TODO eventually this can be internal
	this.drawPaintGrid = true;

	var drawingId = "A";

	this.explorer = null; // TODO: hacky way to tie this to a paint explorer -- should use events instead

	//paint canvas & context
	canvas.width = tilesize * paint_scale;
	canvas.height = tilesize * paint_scale;
	var ctx = canvas.getContext("2d");

	// paint events
	canvas.addEventListener("mousedown", onMouseDown);
	canvas.addEventListener("mousemove", onMouseMove);
	canvas.addEventListener("mouseup", onMouseUp);
	canvas.addEventListener("mouseleave", onMouseUp);
	canvas.addEventListener("touchstart", onTouchStart);
	canvas.addEventListener("touchmove", onTouchMove);
	canvas.addEventListener("touchend", onTouchEnd);

	// TODO : 
	function onMouseDown(e) {
		e.preventDefault();
		
		if (isPlayMode) {
			return; //can't paint during play mode
		}

		console.log("PAINT TOOL!!!");
		console.log(e);

		var off = getOffset(e);

		off = mobileOffsetCorrection(off,e,(tilesize));

		var x = Math.floor(off.x);
		var y = Math.floor(off.y);

		// non-responsive version
		// var x = Math.floor(off.x / paint_scale);
		// var y = Math.floor(off.y / paint_scale);

		if (curDrawingData()[y][x] == 0) {
			curPaintBrush = 1;
		}
		else {
			curPaintBrush = 0;
		}
		curDrawingData()[y][x] = curPaintBrush;
		self.updateCanvas();
		isPainting = true;
	}

	function onMouseMove(e) {
		if (isPainting) {
			var off = getOffset(e);

			off = mobileOffsetCorrection(off,e,(tilesize));

			var x = Math.floor(off.x);// / paint_scale);
			var y = Math.floor(off.y);// / paint_scale);
			curDrawingData()[y][x] = curPaintBrush;
			self.updateCanvas();
		}
	}

	function onMouseUp(e) {
		if (isPainting) {
			isPainting = false;

			refreshGameData();

			// hacky way to force drawing to re-render
			renderer.SetImageSource(getRenderId(), getImageSource());

			roomTool.drawEditMap(); // TODO : events instead of direct coupling

			if (self.explorer != null) {
				self.explorer.RenderThumbnail(drawingId);
			}
			if (self.isCurDrawingAnimated) {
				renderAnimationPreview(drawingId);
			}
		}
	}

	function onTouchStart(e) {
		e.preventDefault();
		var fakeEvent = { target:e.target, clientX:e.touches[0].clientX, clientY:e.touches[0].clientY };
		onMouseDown(fakeEvent);
	}

	function onTouchMove(e) {
		e.preventDefault();
		var fakeEvent = { target:e.target, clientX:e.touches[0].clientX, clientY:e.touches[0].clientY };
		onMouseMove(fakeEvent);
	}

	function onTouchEnd(e) {
		e.preventDefault();
		onMouseUp();
	}

	this.updateCanvas = function() {
		//background
		ctx.fillStyle = "rgb("+getPal(curPal())[0][0]+","+getPal(curPal())[0][1]+","+getPal(curPal())[0][2]+")";
		ctx.fillRect(0,0,canvas.width,canvas.height);

		//pixel color
		var colorIndex = object[drawingId].col;
		var color = getPal(curPal())[colorIndex];
		ctx.fillStyle = "rgb(" + color[0] + "," + color[1] + "," + color[2] + ")";

		//draw pixels
		for (var x = 0; x < 8; x++) {
			for (var y = 0; y < 8; y++) {
				// draw alternate frame
				if (self.isCurDrawingAnimated && curDrawingAltFrameData()[y][x] === 1) {
					ctx.globalAlpha = 0.3;
					ctx.fillRect(x*paint_scale,y*paint_scale,1*paint_scale,1*paint_scale);
					ctx.globalAlpha = 1;
				}
				// draw current frame
				if (curDrawingData()[y][x] === 1) {
					ctx.fillRect(x*paint_scale,y*paint_scale,1*paint_scale,1*paint_scale);
				}
			}
		}

		//draw grid
		if (self.drawPaintGrid) {
			ctx.fillStyle = getContrastingColor();

			for (var x = 1; x < tilesize; x++) {
				ctx.fillRect(x*paint_scale,0*paint_scale,1,tilesize*paint_scale);
			}
			for (var y = 1; y < tilesize; y++) {
				ctx.fillRect(0*paint_scale,y*paint_scale,tilesize*paint_scale,1);
			}
		}
	}

	function getImageSource() {
		return renderer.GetImageSource(object[drawingId].drw);
	}

	function getFrameData(frameIndex) {
		return getImageSource()[frameIndex];
	}

	function getRenderId() {
		return object[drawingId].drw;
	}

	function getDrawingType() {
		return getDrawingTypeFromId(drawingId);
	}

	function curDrawingData() {
		var frameIndex = (self.isCurDrawingAnimated ? self.curDrawingFrameIndex : 0);
		return getFrameData(frameIndex);
	}

	// todo: assumes 2 frames
	function curDrawingAltFrameData() {
		var frameIndex = (self.curDrawingFrameIndex === 0 ? 1 : 0);
		return getFrameData(frameIndex);
	}

	// TODO : refactor these so it doesn't require these weird external hookups!
	// methods for updating the UI
	this.reloadDrawing = function() {
		reloadDrawing(); // TODO : refactor this global method...
	}

	this.selectDrawing = function(id) {
		drawingId = id;
		self.reloadDrawing();
		self.updateCanvas();
	}

	this.toggleWall = function(checked) {
		if (getDrawingType() != TileType.Tile) {
			return;
		}

		if (object[drawingId].isWall == undefined || object[drawingId].isWall == null) {
			// clear out any existing wall settings for this tile in any rooms
			// (this is back compat for old-style wall settings)
			for (roomId in room) {
				var i = room[roomId].walls.indexOf(drawingId);
				
				if (i > -1) {
					room[roomId].walls.splice(i , 1);
				}
			}
		}

		object[drawingId].isWall = checked;

		refreshGameData();

		// TODO : move this global function into paint.js
		if (toggleWallUI != null && toggleWallUI != undefined) {
			toggleWallUI(checked);
		}
	}

	// TODO : who uses this?
	this.getCurObject = function() {
		console.log("GET OBJECT " + drawingId);
		return object[drawingId];
	}

	// TODO : replace with something that lets you pick the new type of drawing!
	this.newDrawing = function(imageData) {
		if (getDrawingType() == TileType.Tile) {
			newTile(imageData);
		}
		else if (getDrawingType() == TileType.Avatar || getDrawingType() == TileType.Sprite) {
			newSprite(imageData);
		}
		else if (getDrawingType() == TileType.Item) {
			newItem(imageData);
		}

		// update paint explorer
		self.explorer.AddThumbnail(drawingId);
		self.explorer.ChangeSelection(drawingId);
		document.getElementById("paintExplorerFilterInput").value = ""; // super hacky

		// this is a bit hacky feeling -- TODO : these direct connections could be replaced with events!
		self.explorer.Refresh(
			getDrawingType(),
			true /*doKeepOldThumbnails*/,
			document.getElementById("paintExplorerFilterInput").value /*filterString*/,
			true /*skipRenderStep*/);
	}

	this.duplicateDrawing = function() {
		var sourceImageData = renderer.GetImageSource(getRenderId());
		var copiedImageData = copyDrawingData(sourceImageData);

		// tiles have extra data to copy
		var tileIsWall = false;
		if (getDrawingType() === TileType.Tile) {
			tileIsWall = object[drawingId].isWall;
		}

		this.newDrawing(copiedImageData);

		// tiles have extra data to copy
		if (getDrawingType() === TileType.Tile) {
			object[drawingId].isWall = tileIsWall;
			// make sure the wall toggle gets updated
			self.reloadDrawing();
		}
	}

	// TODO -- should these newDrawing methods be internal to PaintTool?
	function newTile(imageData) {
		drawingId = nextTileId(); // TODO : need only one "new id" method now

		makeTile(drawingId, imageData);
		self.reloadDrawing(); //hack for ui consistency (hack x 2: order matters for animated tiles)

		self.updateCanvas();
		refreshGameData();

		tileIndex = Object.keys(tile).length - 1;
	}

	function newSprite(imageData) {
		drawingId = nextSpriteId();

		makeSprite(drawingId, imageData);
		self.reloadDrawing(); //hack (order matters for animated tiles)

		self.updateCanvas();
		refreshGameData();

		spriteIndex = Object.keys(sprite).length - 1;
	}

	function newItem(imageData) {
		drawingId = nextItemId();

		makeItem(drawingId, imageData);
		self.reloadDrawing(); //hack (order matters for animated tiles)

		self.updateCanvas();
		updateInventoryItemUI();
		refreshGameData();

		itemIndex = Object.keys(item).length - 1;
	}

	// TODO - may need to extract this for different tools beyond the paint tool (put it in core.js?)
	this.deleteDrawing = function() {
		if (getDrawingType() == TileType.Avatar) {
			alert("You can't delete the player! :(");
			return;
		}

		if (confirm("Are you sure you want to delete this drawing?")) {
			if (getDrawingType() == TileType.Tile) {
				findAndReplaceTileInAllRooms(drawingId, "0");
			}
			else if (getDrawingType() == TileType.Item) {
				removeAllItems(drawingId);
			}
			// TODO : remove all object locations

			var dlgId = object[drawingId].dlg;
			if (dlgId && dialog[dlgId]) {
				delete dialog[dlgId];
			}

			delete object[drawingId];

			// TODO : replace these things with events!
			refreshGameData();
			// TODO RENDERER : refresh images
			roomTool.drawEditMap();
			updateInventoryItemUI();
			// nextItem(); // TODO : replace with "nextDrawing"
			self.explorer.DeleteThumbnail(drawingId);
			self.explorer.ChangeSelection(drawingId);
		}
	}

	events.Listen("palette_change", function(event) {
		self.updateCanvas();

		if (self.isCurDrawingAnimated) {
			// TODO -- this animation stuff needs to be moved in here I think?
			renderAnimationPreview(drawingId);
		}
	});
}

/*
 PAINT UTILS
*/

function getDrawingTypeFromId(drawingId) {
	if (drawingId === "A") {
		return TileType.Avatar;
	}
	else if (object[drawingId].type === "SPR") {
		return TileType.Sprite;
	}
	else if (object[drawingId].type === "TIL") {
		return TileType.Tile;
	}
	else if (object[drawingId].type === "ITM") {
		return TileType.Item;
	}

	return null; // uh oh
}

/*
 PAINT GLOBALS
 TODO : refactor
*/

// TODO : make non-global
// TODO : rename... this is now the whole UI update for drawings...
function reloadDrawing() {
	// animation UI
	if (object[curDrawingId] && object[curDrawingId].animation.isAnimated) {
		paintTool.isCurDrawingAnimated = true;
		document.getElementById("animatedCheckbox").checked = true;

		if (paintTool.curDrawingFrameIndex == 0)
		{
			document.getElementById("animationKeyframe1").className = "animationThumbnail left selected";
			document.getElementById("animationKeyframe2").className = "animationThumbnail right unselected";
		}
		else if (paintTool.curDrawingFrameIndex == 1)
		{
			document.getElementById("animationKeyframe1").className = "animationThumbnail left unselected";
			document.getElementById("animationKeyframe2").className = "animationThumbnail right selected";
		}

		document.getElementById("animation").setAttribute("style","display:block;");
		document.getElementById("animatedCheckboxIcon").innerHTML = "expand_more";
		renderAnimationPreview(curDrawingId);
	}
	else {
		paintTool.isCurDrawingAnimated = false;
		document.getElementById("animatedCheckbox").checked = false;
		document.getElementById("animation").setAttribute("style","display:none;");
		document.getElementById("animatedCheckboxIcon").innerHTML = "expand_less";
	}

	// wall UI
	if (object[curDrawingId].type === "TIL") {
		document.getElementById("wall").setAttribute("style", "display:block;");
		updateWallCheckboxOnCurrentTile();
	}
	else {
		document.getElementById("wall").setAttribute("style", "display:none;");
	}

	// dialog UI
	if (curDrawingId === "A" || object[curDrawingId].type === "TIL") {
		document.getElementById("dialog").setAttribute("style", "display:none;");
	}
	else {
		document.getElementById("dialog").setAttribute("style", "display:block;");
		reloadDialogUI();
	}

	if (object[curDrawingId].type === "ITM") {
		document.getElementById("showInventoryButton").setAttribute("style","display:inline-block;");
	}
	else {
		document.getElementById("showInventoryButton").setAttribute("style","display:none;");
	}

	updateDrawingNameUI(curDrawingId != "A");

	var disableForAvatarElements = document.getElementsByClassName("disableForAvatar");
	for (var i = 0; i < disableForAvatarElements.length; i++) {
		disableForAvatarElements[i].disabled = curDrawingId === "A";
	}

	// update paint canvas
	paintTool.updateCanvas();
}

function updateAnimationUI() {
	//todo
}

function updateWallCheckboxOnCurrentTile() {
	var isCurTileWall = false;

	if (object[curDrawingId].isWall == undefined || object[curDrawingId].isWall == null ) {
		if (room[curRoom]) {
			isCurTileWall = (room[curRoom].walls.indexOf(curDrawingId) != -1);
		}
	}
	else {
		isCurTileWall = object[curDrawingId].isWall;
	}

	if (isCurTileWall) {
		document.getElementById("wallCheckbox").checked = true;
		document.getElementById("wallCheckboxIcon").innerHTML = "border_outer";
	}
	else {
		document.getElementById("wallCheckbox").checked = false;
		document.getElementById("wallCheckboxIcon").innerHTML = "border_clear";
	}
}

function updateDrawingNameUI() {
	var obj = object[curDrawingId];

	if (obj.id === "A") { // hacky
		document.getElementById("drawingName").value = "avatar"; // TODO: localize
	}
	else if (obj.name != null) {
		document.getElementById("drawingName").value = obj.name;
	}
	else {
		document.getElementById("drawingName").value = "";
	}

	document.getElementById("drawingName").placeholder = getCurPaintModeStr() + " " + obj.id;

	document.getElementById("drawingName").readOnly = obj.id === "A";
}

function on_paint_avatar() {
	curDrawingId = "A";
	paintTool.selectDrawing(curDrawingId);
	if(paintExplorer != null) { 
		paintExplorer.Refresh(TileType.Sprite);
		paintExplorer.ChangeSelection(curDrawingId);
	}

	on_paint_avatar_ui_update();
}

function on_paint_avatar_ui_update() {
	document.getElementById("dialog").setAttribute("style","display:none;");
	document.getElementById("wall").setAttribute("style","display:none;");
	// TODO : make navigation commands un-clickable
	document.getElementById("animationOuter").setAttribute("style","display:block;");
	updateDrawingNameUI(false);
	document.getElementById("paintOptionAvatar").checked = true;
	document.getElementById("paintExplorerOptionAvatar").checked = true;
	document.getElementById("showInventoryButton").setAttribute("style","display:none;");
	document.getElementById("paintExplorerAdd").setAttribute("style","display:none;");
	document.getElementById("paintExplorerFilterInput").value = "";

	var disableForAvatarElements = document.getElementsByClassName("disableForAvatar");
	for (var i = 0; i < disableForAvatarElements.length; i++) {
		disableForAvatarElements[i].disabled = true;
	}
}

function on_paint_tile() {
	drawing.type = TileType.Tile;
	tileIndex = 0;
	drawing.id = sortedTileIdList()[tileIndex];
	paintTool.reloadDrawing();
	paintExplorer.Refresh( paintTool.drawing.type );
	paintExplorer.ChangeSelection( paintTool.drawing.id );

	on_paint_tile_ui_update();
}

function on_paint_tile_ui_update() {
	document.getElementById("dialog").setAttribute("style","display:none;");
	document.getElementById("wall").setAttribute("style","display:block;");
	document.getElementById("animationOuter").setAttribute("style","display:block;");
	updateDrawingNameUI(true);
	//document.getElementById("animation").setAttribute("style","display:block;");
	document.getElementById("paintOptionTile").checked = true;
	document.getElementById("paintExplorerOptionTile").checked = true;
	document.getElementById("showInventoryButton").setAttribute("style","display:none;");
	document.getElementById("paintExplorerAdd").setAttribute("style","display:inline-block;");
	document.getElementById("paintExplorerFilterInput").value = "";

	var disableForAvatarElements = document.getElementsByClassName("disableForAvatar");
	for (var i = 0; i < disableForAvatarElements.length; i++) {
		disableForAvatarElements[i].disabled = false;
	}
}

function on_paint_sprite() {
	drawing.type = TileType.Sprite;
	if (sortedSpriteIdList().length > 1)
	{
		spriteIndex = 1;
	}
	else {
		spriteIndex = 0; //fall back to avatar if no other sprites exist
	}
	drawing.id = sortedSpriteIdList()[spriteIndex];
	paintTool.curDrawingFrameIndex = 0;
	paintTool.reloadDrawing();
	paintExplorer.Refresh( paintTool.drawing.type );
	paintExplorer.ChangeSelection( paintTool.drawing.id );

	on_paint_sprite_ui_update();
}

function on_paint_sprite_ui_update() {
	document.getElementById("dialog").setAttribute("style","display:block;");
	document.getElementById("wall").setAttribute("style","display:none;");
	document.getElementById("animationOuter").setAttribute("style","display:block;");
	updateDrawingNameUI(true);
	//document.getElementById("animation").setAttribute("style","display:block;");
	document.getElementById("paintOptionSprite").checked = true;
	document.getElementById("paintExplorerOptionSprite").checked = true;
	document.getElementById("showInventoryButton").setAttribute("style","display:none;");
	document.getElementById("paintExplorerAdd").setAttribute("style","display:inline-block;");
	document.getElementById("paintExplorerFilterInput").value = "";

	var disableForAvatarElements = document.getElementsByClassName("disableForAvatar");
	for (var i = 0; i < disableForAvatarElements.length; i++) {
		disableForAvatarElements[i].disabled = false;
	}
}

function on_paint_item() {
	console.log("PAINT ITEM");
	drawing.type = TileType.Item;
	itemIndex = 0;
	drawing.id = sortedItemIdList()[itemIndex];
	console.log(drawing.id);
	paintTool.curDrawingFrameIndex = 0;
	paintTool.reloadDrawing();
	paintExplorer.Refresh( paintTool.drawing.type );
	paintExplorer.ChangeSelection( paintTool.drawing.id );

	on_paint_item_ui_update();
}

function on_paint_item_ui_update() {
	document.getElementById("dialog").setAttribute("style","display:block;");
	document.getElementById("wall").setAttribute("style","display:none;");
	document.getElementById("animationOuter").setAttribute("style","display:block;");
	updateDrawingNameUI(true);
	//document.getElementById("animation").setAttribute("style","display:block;");
	document.getElementById("paintOptionItem").checked = true;
	document.getElementById("paintExplorerOptionItem").checked = true;
	document.getElementById("showInventoryButton").setAttribute("style","display:inline-block;");
	document.getElementById("paintExplorerAdd").setAttribute("style","display:inline-block;");
	document.getElementById("paintExplorerFilterInput").value = "";

	var disableForAvatarElements = document.getElementsByClassName("disableForAvatar");
	for (var i = 0; i < disableForAvatarElements.length; i++) {
		disableForAvatarElements[i].disabled = false;
	}
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

/* ANIMATION EDITING*/
// TODO: de-globalify!
function on_toggle_animated() {
	if (document.getElementById("animatedCheckbox").checked) {
		addObjectAnimation(curDrawingId);
		document.getElementById("animation").setAttribute("style","display:block;");
		document.getElementById("animatedCheckboxIcon").innerHTML = "expand_more";
		renderAnimationPreview(curDrawingId);
	}
	else {
		removeObjectAnimation(curDrawingId);
		document.getElementById("animation").setAttribute("style","display:none;");
		document.getElementById("animatedCheckboxIcon").innerHTML = "expand_less";
	}
	// renderPaintThumbnail(drawing);
}

// TODO : de-globalify this
function addObjectAnimation(drawingId) {
	//set editor mode
	paintTool.isCurDrawingAnimated = true;
	paintTool.curDrawingFrameIndex = 0;

	//mark object as animated
	object[drawingId].animation.isAnimated = true;
	object[drawingId].animation.frameIndex = 0;
	object[drawingId].animation.frameCount = 2;

	//add blank frame to object (or restore removed animation)
	if (object[drawingId].cachedAnimation != null) {
		restoreDrawingAnimation(object[drawingId].drw, object[drawingId].cachedAnimation);
	}
	else {
		addNewFrameToDrawing(object[drawingId].drw);
	}

	// TODO RENDERER : refresh images

	//refresh data model
	refreshGameData();
	paintTool.reloadDrawing();

	// reset animations
	resetAllAnimations();
}

function removeObjectAnimation(drawingId) {
	//set editor mode
	paintTool.isCurDrawingAnimated = false;

	//mark object as non-animated
	object[drawingId].animation.isAnimated = false;
	object[drawingId].animation.frameIndex = 0;
	object[drawingId].animation.frameCount = 0;

	//remove all but the first frame of the object
	cacheDrawingAnimation(object[drawingId], object[drawingId].drw);
	removeDrawingAnimation(object[drawingId].drw);

	// TODO RENDERER : refresh images

	//refresh data model
	refreshGameData();
	paintTool.reloadDrawing();

	// reset animations
	resetAllAnimations();
}

function addNewFrameToDrawing(drwId) {
	// copy first frame data into new frame
	var imageSource = renderer.GetImageSource(drwId);
	var firstFrame = imageSource[0];
	var newFrame = [];
	for (var y = 0; y < tilesize; y++) {
		newFrame.push([]);
		for (var x = 0; x < tilesize; x++) {
			newFrame[y].push( firstFrame[y][x] );
		}
	}
	imageSource.push( newFrame );
	renderer.SetImageSource(drwId, imageSource);
}

function removeDrawingAnimation(drwId) {
	var imageSource = renderer.GetImageSource(drwId);
	var oldImageData = imageSource.slice(0);
	renderer.SetImageSource( drwId, [ oldImageData[0] ] );
}

// let's us restore the animation during the session if the user wants it back
function cacheDrawingAnimation(drawing,sourceId) {
	var imageSource = renderer.GetImageSource(sourceId);
	var oldImageData = imageSource.slice(0);
	drawing.cachedAnimation = [ oldImageData[1] ]; // ah the joys of javascript
}

function restoreDrawingAnimation(sourceId,cachedAnimation) {
	var imageSource = renderer.GetImageSource(sourceId);
	for (f in cachedAnimation) {
		imageSource.push( cachedAnimation[f] );	
	}
	renderer.SetImageSource(sourceId, imageSource);
}

function on_paint_frame1() {
	paintTool.curDrawingFrameIndex = 0;
	paintTool.reloadDrawing();
}

function on_paint_frame2() {
	paintTool.curDrawingFrameIndex = 1;
	paintTool.reloadDrawing();
}

/* PAINT NAVIGATION */
function next() {
	var ids = sortedDrawingIdList();

	// TODO : is this global drawing index good?
	curDrawingIndex = (curDrawingIndex + 1) % ids.length;
	curDrawingId = ids[curDrawingIndex];

	paintTool.curDrawingFrameIndex = 0;
	paintTool.selectDrawing(curDrawingId);
	paintExplorer.ChangeSelection(curDrawingId);
}

function prev() {
	var ids = sortedDrawingIdList();

	curDrawingIndex = (curDrawingIndex - 1) % ids.length;
	if (curDrawingIndex < 0) {
		curDrawingIndex = (ids.length-1); //loop
	}
	curDrawingId = ids[curDrawingIndex];

	paintTool.curDrawingFrameIndex = 0;
	paintTool.selectDrawing(curDrawingId);
	paintExplorer.ChangeSelection(curDrawingId);
}