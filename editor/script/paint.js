/*
	PAINT
*/

function PaintTool(controls) {
	var self = this; // feels a bit hacky

	var paint_scale = 32;
	var curPaintBrush = 0;
	var isPainting = false;
	var drawPaintGrid = true;

	var drawingId = "A";
	var curDrawingFrameIndex = 0;

	var animationControl = new AnimationControl(
		function(index) {
			curDrawingFrameIndex = index;
			self.UpdateCanvas();
		},
		controls.animation);

	//paint canvas & context
	controls.canvas.width = tilesize * paint_scale;
	controls.canvas.height = tilesize * paint_scale;
	var ctx = controls.canvas.getContext("2d");

	// paint events
	controls.canvas.addEventListener("mousedown", onMouseDown);
	controls.canvas.addEventListener("mousemove", onMouseMove);
	controls.canvas.addEventListener("mouseup", onMouseUp);
	controls.canvas.addEventListener("mouseleave", onMouseUp);
	controls.canvas.addEventListener("touchstart", onTouchStart);
	controls.canvas.addEventListener("touchmove", onTouchMove);
	controls.canvas.addEventListener("touchend", onTouchEnd);

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
		self.UpdateCanvas();
		isPainting = true;
	}

	function onMouseMove(e) {
		if (isPainting) {
			var off = getOffset(e);

			off = mobileOffsetCorrection(off,e,(tilesize));

			var x = Math.floor(off.x);// / paint_scale);
			var y = Math.floor(off.y);// / paint_scale);
			curDrawingData()[y][x] = curPaintBrush;
			self.UpdateCanvas();
		}
	}

	function onMouseUp(e) {
		if (isPainting) {
			isPainting = false;

			refreshGameData();

			// hacky way to force drawing to re-render
			renderer.SetImageSource(getRenderId(), getImageSource());

			events.Raise("change_drawing", { id: drawingId });

			animationControl.RefreshCurFrame();
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

	controls.nameInput.oninput = function(e) {
		var str = controls.nameInput.value;
		var til = tile[drawingId];
		var oldName = til.name;

		if (str.length > 0) {
			til.name = str;
		}
		else {
			til.name = null;
		}

		updateNamesFromCurData(); // todo : does this even work anymore?

		// make sure items referenced in scripts update their names
		if (til.type === TileType.Item) {
			// console.log("SWAP ITEM NAMES");
			// todo : re-implement -- update item names in scripts!
			updateInventoryItemUI(); // todo : use event instead?
		}

		refreshGameData();

		events.Raise("change_drawing_name", { id: til.id, name: til.name });
	}

	this.UpdateCanvas = function() {
		//background
		ctx.fillStyle = "rgb("+getPal(curPal())[0][0]+","+getPal(curPal())[0][1]+","+getPal(curPal())[0][2]+")";
		ctx.fillRect(0, 0, controls.canvas.width, controls.canvas.height);

		//pixel color
		var colorIndex = tile[drawingId].col;
		var color = getPal(curPal())[colorIndex];
		ctx.fillStyle = "rgb(" + color[0] + "," + color[1] + "," + color[2] + ")";

		//draw pixels
		for (var x = 0; x < 8; x++) {
			for (var y = 0; y < 8; y++) {
				// draw alternate frame
				if (isCurDrawingAnimated() && curDrawingAltFrameData()[y][x] === 1) {
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
		if (drawPaintGrid) {
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
		return renderer.GetImageSource(tile[drawingId].drw);
	}

	function getFrameData(frameIndex) {
		return getImageSource()[frameIndex];
	}

	function getRenderId() {
		return tile[drawingId].drw;
	}

	function getDrawingType() {
		return getDrawingTypeFromId(drawingId);
	}

	function isCurDrawingAnimated() {
		return tile[drawingId].animation.isAnimated;
	}

	function curDrawingData() {
		return getFrameData(curDrawingFrameIndex);
	}

	function curDrawingAltFrameData() {
		var frameIndex = Math.max(0, curDrawingFrameIndex - 1);
		return getFrameData(frameIndex);
	}

	events.Listen("item_inventory_change", function(e) {
		if (e.id === drawingId) {
			controls.settings.inventory.input.value = e.count;
		}
	});

	// TODO : rename!
	this.ReloadDrawing = function() {
		// animation UI
		animationControl.ChangeDrawing(drawingId);

		var hasSettings = false;

		// wall UI
		if (tile[drawingId].type === "TIL") {
			hasSettings = true;
			controls.settings.wall.container.setAttribute("style", "display:block;");
			updateWallCheckboxOnCurrentTile();
		}
		else {
			controls.settings.wall.container.setAttribute("style", "display:none;");
		}

		// dialog UI
		if (drawingId === "A" || tile[drawingId].type === "TIL") {
			controls.dialogControl.setAttribute("style", "display:none;");
		}
		else {
			controls.dialogControl.setAttribute("style", "display:block;");
			reloadDialogUI();
		}

		if (tile[drawingId].type === "ITM") {
			hasSettings = true;
			controls.settings.inventory.container.setAttribute("style","display:block;");
			var itemCount = drawingId in tile[playerId].inventory ? tile[playerId].inventory[drawingId] : 0;
			controls.settings.inventory.input.value = itemCount;
			controls.settings.inventory.input.oninput = function(e) {
				console.log(e.target.value);
				if (e.target.value <= 0) {
					delete tile[playerId].inventory[drawingId];
				}
				else {
					tile[playerId].inventory[drawingId] = e.target.value;
					refreshGameData();
				}

				events.Raise("item_inventory_change", { id: drawingId, count: e.target.value, });
			};
		}
		else {
			controls.settings.inventory.container.setAttribute("style","display:none;");
		}

		if (tile[drawingId].type === "EXT") {
			hasSettings = true;
			controls.settings.exit.destination.style.display = "block";
			controls.settings.exit.transitionEffect.style.display = "block";
			var effectId = tile[drawingId].transition_effect ? tile[drawingId].transition_effect : "none";
			controls.settings.exit.transitionSelect.value = effectId;
		}
		else {
			controls.settings.exit.destination.style.display = "none";
			controls.settings.exit.transitionEffect.style.display = "none";
		}

		if (tile[drawingId].type === "EXT" || tile[drawingId].type === "END") {
			hasSettings = true;
			UpdateLockSettingControls(true);
		}
		else {
			UpdateLockSettingControls(false);
		}

		controls.settings.container.style.display = hasSettings ? "block" : "none";

		updateDrawingNameUI();

		var disableForAvatarElements = document.getElementsByClassName("disableForAvatar");
		for (var i = 0; i < disableForAvatarElements.length; i++) {
			disableForAvatarElements[i].disabled = drawingId === "A";
		}

		// update paint canvas
		self.UpdateCanvas();

		if (findTool) {
			var typeIconId = findTool.GetIconId("drawing", drawingId);
			controls.typeButton.innerHTML = "";
			controls.typeButton.appendChild(iconUtils.CreateIcon(typeIconId));
		}
	}

	// TODO : remove this after moving everything to events
	this.SelectDrawing = function(id) {
		events.Raise("select_drawing", { id: id });
	}

	events.Listen("select_drawing", function(e) {
		drawingId = e.id;
		self.ReloadDrawing();
	});

	this.ToggleWall = function(checked) {
		if (getDrawingType() != TileType.Tile) {
			return;
		}

		if (tile[drawingId].isWall == undefined || tile[drawingId].isWall == null) {
			// clear out any existing wall settings for this tile in any rooms
			// (this is back compat for old-style wall settings)
			for (roomId in room) {
				var i = room[roomId].walls.indexOf(drawingId);
				
				if (i > -1) {
					room[roomId].walls.splice(i , 1);
				}
			}
		}

		tile[drawingId].isWall = checked;

		refreshGameData();

		// TODO : move this global function into paint.js
		if (toggleWallUI != null && toggleWallUI != undefined) {
			toggleWallUI(checked);
		}
	}

	// TODO : who uses this? once in reload paint dialog ui, and once in this file... probably could be removed
	this.GetCurTile = function() {
		return tile[drawingId];
	}

	var lastAddType = "TIL";

	function NewDrawing(type, imageData) {
		var nextId = nextObjectId(sortedBase36IdList(tile)); // TODO : helper function?
		createTile(nextId, type, { drawingData:imageData });
		refreshGameData();

		events.Raise("add_drawing", { id: nextId });
		self.SelectDrawing(nextId);

		// TODO : hack... replace with event hookup
		if (type === "ITM") {
			updateInventoryItemUI();
			
			if (lockItemSelect) {
				lockItemSelect.UpdateOptions();
			}
		}

		lastAddType = type;
	}

	var isAddVisible = false;

	function ShowNewDrawingControls(isVisible) {
		controls.editRoot.style.display = isVisible ? "none" : "block";
		controls.add.container.style.display = isVisible ? "flex" : "none";
		controls.nameInput.disabled = isVisible;
		controls.nav.prev.disabled = isVisible;
		controls.nav.next.disabled = isVisible;
		controls.nav.copy.disabled = isVisible;
		controls.nav.del.disabled = isVisible;

		if (isVisible) {
			controls.nav.add.classList.add("reverseColors");
		}
		else {
			controls.nav.add.classList.remove("reverseColors");
		}

		isAddVisible = isVisible;
	}

	controls.nav.add.onclick = function() {
		if (isAddVisible) {
			NewDrawing(lastAddType);
			ShowNewDrawingControls(false);
		}
		else {
			ShowNewDrawingControls(true);
		}
	};

	controls.add.tile.onclick = function() {
		NewDrawing("TIL");
		ShowNewDrawingControls(false);
	};

	controls.add.sprite.onclick = function() {
		NewDrawing("SPR");
		ShowNewDrawingControls(false);
	};

	controls.add.item.onclick = function() {
		NewDrawing("ITM");
		ShowNewDrawingControls(false);
	};

	controls.add.exit.onclick = function() {
		NewDrawing("EXT");
		ShowNewDrawingControls(false);
	};

	controls.add.ending.onclick = function() {
		NewDrawing("END");
		ShowNewDrawingControls(false);
	};

	controls.add.cancel.onclick = function() {
		ShowNewDrawingControls(false);
	};

	function DuplicateDrawing() {
		var sourceImageData = renderer.GetImageSource(getRenderId());

		var type = tile[drawingId].type;

		// tiles have extra data to copy
		var tileIsWall = false;
		if (getDrawingType() === TileType.Tile) {
			tileIsWall = tile[drawingId].isWall;
		}

		NewDrawing(type, sourceImageData);

		// HACKY
		// tiles have extra data to copy
		if (getDrawingType() === TileType.Tile) {
			tile[drawingId].isWall = tileIsWall;
			// make sure the wall toggle gets updated
			self.ReloadDrawing();
		}
	}
	controls.nav.copy.onclick = DuplicateDrawing;

	// TODO - may need to extract this for different tools beyond the paint tool (put it in core.js?)
	function DeleteDrawing() {
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
			// TODO : remove all sprite locations

			var dlgId = tile[drawingId].dlg;
			if (dlgId && dialog[dlgId]) {
				delete dialog[dlgId];
			}

			delete tile[drawingId];

			events.Raise("delete_drawing", { id: drawingId });

			// TODO : replace these things with events!
			refreshGameData();
			// TODO RENDERER : refresh images
			updateInventoryItemUI();

			if (lockItemSelect) {
				lockItemSelect.UpdateOptions();
			}

			nextDrawing();

			// TODO : add event
			// self.explorer.DeleteThumbnail(drawingId);
			// self.explorer.ChangeSelection(drawingId);
		}
	}
	controls.nav.del.onclick = DeleteDrawing;

	function updateWallCheckboxOnCurrentTile() {
		var isCurTileWall = false;

		if (tile[drawingId].isWall == undefined || tile[drawingId].isWall == null ) {
			if (room[curRoom]) {
				isCurTileWall = (room[curRoom].walls.indexOf(drawingId) != -1);
			}
		}
		else {
			isCurTileWall = tile[drawingId].isWall;
		}

		if (isCurTileWall) {
			controls.settings.wall.checkbox.checked = true;
			iconUtils.LoadIcon(controls.settings.wall.icon, "wall_on");
			controls.settings.wall.text.innerText = "yes "; // todo : localize
		}
		else {
			controls.settings.wall.checkbox.checked = false;
			iconUtils.LoadIcon(controls.settings.wall.icon, "wall_off");
			controls.settings.wall.text.innerText = "no "; // todo : localize
		}
	}

	function updateDrawingNameUI() {
		var til = tile[drawingId];

		// todo : simplify?
		if (til.id === "A") { // hacky
			controls.nameInput.value = "avatar"; // TODO: localize
		}
		else if (til.name != null) {
			controls.nameInput.value = til.name;
		}
		else {
			controls.nameInput.value = "";
		}

		// will this safety conditional bite me? can I have the find tool load earlier?
		if (findTool) {
			controls.nameInput.placeholder = findTool.GetDisplayName("drawing", drawingId, true);
		}

		controls.nameInput.readOnly = til.id === "A";
	}

	this.SetPaintGrid = function(isVisible) {
		drawPaintGrid = isVisible;
		iconUtils.LoadIcon(controls.gridIcon, isVisible ? "visibility" : "visibility_off");
		self.UpdateCanvas();
	}

	// let's us restore the animation during the session if the user wants it back
	function cacheDrawingAnimation(drawing, sourceId) {
		var imageSource = renderer.GetImageSource(sourceId);
		var oldImageData = imageSource.slice(0);
		drawing.cachedAnimation = [ oldImageData[1] ]; // ah the joys of javascript
	}

	function restoreDrawingAnimation(sourceId, cachedAnimation) {
		var imageSource = renderer.GetImageSource(sourceId);
		for (f in cachedAnimation) {
			imageSource.push( cachedAnimation[f] );
		}
		renderer.SetImageSource(sourceId, imageSource);
	}

	/* NAVIGATION */
	function nextDrawing() {
		var ids = sortedDrawingIdList();

		var index = ids.indexOf(drawingId);
		index = (index + 1) % ids.length;

		self.SelectDrawing(ids[index]);
	}
	this.NextDrawing = nextDrawing;
	controls.nav.next.onclick = nextDrawing;

	function prevDrawing() {
		var ids = sortedDrawingIdList();

		var index = ids.indexOf(drawingId);
		index = (index - 1) % ids.length;
		if (index < 0) {
			index = (ids.length - 1); // loop
		}

		self.SelectDrawing(ids[index]);
	}
	this.PrevDrawing = prevDrawing;
	controls.nav.prev.onclick = prevDrawing;

	// exit transition controls
	controls.settings.exit.transitionSelect.onchange = function(e) {
		if (tile[drawingId].type === "EXT") {
			if (e.target.value === "none") {
				tile[drawingId].transition_effect = null;
			}
			else {
				tile[drawingId].transition_effect = e.target.value;
			}

			refreshGameData();
		}
	};

	var lockItemSelect;
	function UpdateLockSettingControls(isVisible) {
		if (!lockItemSelect && findTool) {
			lockItemSelect = findTool.CreateSelectControl(
				"drawing",
				{
					onSelectChange : function(id) {
						tile[drawingId].lockItem = id;
						refreshGameData();
					},
					filterId : "item",
					toolId : "paintPanel",
					getSelectMessage : function() {
						// todo : localize
						return "select lock item for " + findTool.GetDisplayName("drawing", drawingId) + "...";
					},
				});

			controls.settings.lock.itemInput.appendChild(lockItemSelect.GetElement());

			controls.settings.lock.tollInput.onchange = function(e) {
				if (tile[drawingId].type === "EXT" || tile[drawingId].type === "END") {
					tile[drawingId].lockToll = e.target.value;
					refreshGameData();
				}
			};
		}

		if (!isVisible) {
			controls.settings.lock.container.style.display = "none";
		}
		else {
			controls.settings.lock.container.style.display = "block";

			if (lockItemSelect) {
				lockItemSelect.SetSelection(tile[drawingId].lockItem);
			}

			controls.settings.lock.tollInput.value = tile[drawingId].lockToll;
		}
	}

	events.Listen("change_room_palette", function(event) {
		self.UpdateCanvas();
		animationControl.RefreshAll();
	});

	events.Listen("select_room", function(event) {
		self.UpdateCanvas();
		animationControl.RefreshAll();
	});
}

function AnimationControl(onSelectFrame, controls) {
	var drawingId = null;
	var frameIndex = 0;
	var previewImg = null;
	var thumbnailImgList = [];

	var animationThumbnailRenderer = CreateDrawingThumbnailRenderer();

	function renderThumbnail(img, id, options) {
		function onRenderFinished(uri) {
			img.src = uri;
		};

		animationThumbnailRenderer.Render(id, onRenderFinished, options);
	}

	function refreshFrame(frameIndex) {
		renderThumbnail(previewImg, drawingId, { isAnimated: true, cacheId: "anim_" + drawingId + "_preview", });

		for (var i = 0; i < tile[drawingId].animation.frameCount; i++) {
			if (frameIndex === undefined || frameIndex === null || frameIndex === i) {
				var thumbnailImg = thumbnailImgList[i];
				renderThumbnail(thumbnailImg, drawingId, { frameIndex: i, cacheId: "anim_" + drawingId + "_" + i, });
			}
		}
	}

	// todo : add animation caching back? or just replace with an undo/redo system?
	function addNewFrameToDrawing() {
		// copy last frame data into new frame
		var prevFrameIndex = tile[drawingId].animation.frameCount - 1;
		var imageSource = renderer.GetImageSource(drawingId);
		var prevFrame = imageSource[prevFrameIndex];
		var newFrame = [];
		for (var y = 0; y < tilesize; y++) {
			newFrame.push([]);
			for (var x = 0; x < tilesize; x++) {
				newFrame[y].push(prevFrame[y][x]);
			}
		}
		imageSource.push(newFrame);
		renderer.SetImageSource(drawingId, imageSource);

		// update animation settings
		tile[drawingId].animation.frameCount++;
		tile[drawingId].animation.isAnimated = (tile[drawingId].animation.frameCount > 1);

		//refresh data model
		refreshGameData();

		// add thumbnail
		frameIndex = tile[drawingId].animation.frameCount - 1;
		createThumbnailImg(frameIndex);
		refreshFrame(frameIndex);

		// refresh paint UI
		thumbnailImgList[frameIndex].onclick();

		// reset animations
		resetAllAnimations();

		controls.removeButton.style.display =
			tile[drawingId].animation.frameCount > 1 ? "inline-block" : "none";
	}

	controls.addButton.onclick = addNewFrameToDrawing;

	function removeLastFrameFromDrawing() {
		if (tile[drawingId].animation.frameCount <= 1) {
			return;
		}

		// remove last frame!
		var imageSource = renderer.GetImageSource(drawingId);
		renderer.SetImageSource(drawingId, imageSource.slice(0, imageSource.length - 1));

		// update animation settings
		tile[drawingId].animation.frameCount--;
		tile[drawingId].animation.isAnimated = (tile[drawingId].animation.frameCount > 1);

		//refresh data model
		refreshGameData();

		// remove thumbnail
		controls.framesDiv.removeChild(thumbnailImgList[thumbnailImgList.length - 1]);
		thumbnailImgList = thumbnailImgList.slice(0, thumbnailImgList.length - 1);

		if (frameIndex >= tile[drawingId].animation.frameCount) {
			frameIndex = tile[drawingId].animation.frameCount - 1;
		}

		refreshFrame(frameIndex);

		// refresh paint UI
		thumbnailImgList[frameIndex].onclick();

		// reset animations
		resetAllAnimations();

		controls.removeButton.style.display =
			tile[drawingId].animation.frameCount > 1 ? "inline-block" : "none";
	}

	controls.removeButton.onclick = removeLastFrameFromDrawing;

	function createThumbnailImg(index) {
		var thumbnailImg = document.createElement("img");
		thumbnailImg.classList.add("animationThumbnail");
		thumbnailImg.onclick = function() {
			frameIndex = index;

			for (var i = 0; i < thumbnailImgList.length; i++) {
				if (i === frameIndex) {
					thumbnailImgList[i].classList.add("selected");
				}
				else {
					thumbnailImgList[i].classList.remove("selected");
				}
			}

			onSelectFrame(frameIndex);
		};
		thumbnailImgList.push(thumbnailImg);
		controls.framesDiv.appendChild(thumbnailImg);		
	}

	this.ChangeDrawing = function(id) {
		drawingId = id;
		frameIndex = 0;

		controls.previewDiv.innerHTML = "";
		controls.framesDiv.innerHTML = "";

		previewImg = document.createElement("img");
		previewImg.classList.add("animationThumbnail");
		previewImg.classList.add("preview");
		controls.previewDiv.appendChild(previewImg);

		thumbnailImgList = [];

		for (var i = 0; i < tile[drawingId].animation.frameCount; i++) {
			createThumbnailImg(i);
		}

		refreshFrame();

		thumbnailImgList[frameIndex].onclick();

		controls.removeButton.style.display =
			tile[drawingId].animation.frameCount > 1 ? "inline-block" : "none";
	}

	this.RefreshCurFrame = function() {
		refreshFrame(frameIndex);
	}

	this.RefreshAll = function() {
		refreshFrame();
	}
}

/*
 PAINT UTILS
*/

function getDrawingTypeFromId(drawingId) {
	if (drawingId === "A") {
		return TileType.Avatar;
	}
	else if (tile[drawingId].type === "SPR") {
		return TileType.Sprite;
	}
	else if (tile[drawingId].type === "TIL") {
		return TileType.Tile;
	}
	else if (tile[drawingId].type === "ITM") {
		return TileType.Item;
	}

	return null; // uh oh
}

/* 
 GLOBAL UI HOOKS
 TODO : someday I'll get rid of these, right? who knows...
*/
function on_toggle_wall(e) {
	paintTool.ToggleWall(e.target.checked);
}

function togglePaintGrid(e) {
	paintTool.SetPaintGrid(e.target.checked);
}