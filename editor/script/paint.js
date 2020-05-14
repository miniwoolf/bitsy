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
	this.onReloadTile = null;
	this.onReloadSprite = null;
	this.onReloadItem = null;
	this.reloadDrawing = function() {
		if (object[drawingId].type === "TIL") {
			if (self.onReloadTile) {
				self.onReloadTile();
			}
		}
		else if (object[drawingId].type === "SPR") {
			if (self.onReloadSprite) {
				self.onReloadSprite();
			}
		}
		else if (object[drawingId].type === "ITM") {
			if (self.onReloadItem) {
				self.onReloadItem();
			}
		}
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

