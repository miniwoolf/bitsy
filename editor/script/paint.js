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

	var colorSettings = new ColorSettingsControl(
		controls.settings.color,
		function() {
			self.UpdateCanvas();
		});

	var wallSettings = new WallSettingsControl(controls.settings.wall);
	var inventorySettings = new InventorySettingsControl(controls.settings.inventory);
	var exitSettings = new ExitSettingsControl(controls.settings.exit);
	var lockSettings = new LockSettingsControl(controls.settings.lock);

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
			renderer.SetTileSource(getRenderId(), getTileSource());

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
		if (til.type === TYPE_KEY.ITEM) {
			// console.log("SWAP ITEM NAMES");
			// todo : re-implement -- update item names in scripts!
			updateInventoryItemUI(); // todo : use event instead?
		}

		refreshGameData();

		events.Raise("change_drawing_name", { id: til.id, name: til.name });
	}

	this.UpdateCanvas = function() {
		var backgroundColor = color.GetColor(tile[drawingId].colorOffset + tile[drawingId].bgc);
		var foregroundColor = color.GetColor(tile[drawingId].colorOffset + tile[drawingId].col);

		//background
		ctx.fillStyle = "rgb("+ backgroundColor[0] + "," + backgroundColor[1] + "," + backgroundColor[2] + ")";
		ctx.fillRect(0, 0, controls.canvas.width, controls.canvas.height);

		//pixel color
		ctx.fillStyle = "rgb(" + foregroundColor[0] + "," + foregroundColor[1] + "," + foregroundColor[2] + ")";

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

	function getTileSource() {
		return renderer.GetTileSource(tile[drawingId].drw);
	}

	function getFrameData(frameIndex) {
		return getTileSource()[frameIndex];
	}

	function getRenderId() {
		return tile[drawingId].drw;
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

	// TODO : rename!
	this.ReloadDrawing = function() {
		// animation UI
		animationControl.ChangeDrawing(drawingId);

		var hasSettings = false;

		// dialog UI
		if (drawingId === "A" || tile[drawingId].type === "TIL") {
			UpdateDialogControl(false);
		}
		else {
			UpdateDialogControl(true);
		}

		if (colorSettings.Update(drawingId)) {
			hasSettings = true;
		}

		if (wallSettings.Update(drawingId)) {
			hasSettings = true;
		}

		if (inventorySettings.Update(drawingId)) {
			hasSettings = true;
		}

		if (exitSettings.Update(drawingId)) {
			hasSettings = true;
		}

		if (lockSettings.Update(drawingId)) {
			hasSettings = true;
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
		console.log(drawingId);
		self.ReloadDrawing();
	});

	// TODO : who uses this? once in reload paint dialog ui, and once in this file... probably could be removed
	this.GetCurTile = function() {
		return tile[drawingId];
	}

	var lastAddType = TYPE_KEY.TILE;

	function NewDrawing(type, imageData) {
		var nextId = nextObjectId(sortedBase36IdList(tile)); // TODO : helper function?

		var tileOptions = {
			drawingData: imageData,
			destRoom: type === "EXT" ? "0" : null, // what if there's no room "0"?
		};

		createTile(nextId, type, tileOptions);
		refreshGameData();

		events.Raise("add_drawing", { id: nextId, type: type, });
		self.SelectDrawing(nextId);

		// TODO : hack... replace with event hookup
		if (type === "ITM") {
			updateInventoryItemUI();
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
		NewDrawing(TYPE_KEY.TILE);
		ShowNewDrawingControls(false);
	};

	controls.add.sprite.onclick = function() {
		NewDrawing(TYPE_KEY.SPRITE);
		ShowNewDrawingControls(false);
	};

	controls.add.item.onclick = function() {
		NewDrawing(TYPE_KEY.ITEM);
		ShowNewDrawingControls(false);
	};

	controls.add.exit.onclick = function() {
		NewDrawing(TYPE_KEY.EXIT);
		ShowNewDrawingControls(false);
	};

	controls.add.ending.onclick = function() {
		NewDrawing(TYPE_KEY.ENDING);
		ShowNewDrawingControls(false);
	};

	controls.add.cancel.onclick = function() {
		ShowNewDrawingControls(false);
	};

	function DuplicateDrawing() {
		var sourceImageData = renderer.GetTileSource(getRenderId());

		var type = tile[drawingId].type;

		// tiles have extra data to copy
		var tileIsWall = false;
		if (tile[drawingId].type === TYPE_KEY.TILE) {
			tileIsWall = tile[drawingId].isWall;
		}

		NewDrawing(type, sourceImageData);

		// HACKY
		// tiles have extra data to copy
		if (tile[drawingId].type === TYPE_KEY.TILE) {
			tile[drawingId].isWall = tileIsWall;
			// make sure the wall toggle gets updated
			self.ReloadDrawing();
		}
	}
	controls.nav.copy.onclick = DuplicateDrawing;

	// TODO - may need to extract this for different tools beyond the paint tool (put it in core.js?)
	function DeleteDrawing() {
		if (tile[drawingId].type === TYPE_KEY.AVATAR) {
			alert("You can't delete the player! :(");
			return;
		}

		if (confirm("Are you sure you want to delete this drawing?")) {
			if (tile[drawingId].type === TYPE_KEY.TILE) {
				findAndReplaceTileInAllRooms(drawingId, "0");
			}
			else if (tile[drawingId].type === TYPE_KEY.ITEM) {
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

			nextDrawing();

			// TODO : add event
			// self.explorer.DeleteThumbnail(drawingId);
			// self.explorer.ChangeSelection(drawingId);
		}
	}
	controls.nav.del.onclick = DeleteDrawing;

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
		var imageSource = renderer.GetTileSource(sourceId);
		var oldImageData = imageSource.slice(0);
		drawing.cachedAnimation = [ oldImageData[1] ]; // ah the joys of javascript
	}

	function restoreDrawingAnimation(sourceId, cachedAnimation) {
		var imageSource = renderer.GetTileSource(sourceId);
		for (f in cachedAnimation) {
			imageSource.push( cachedAnimation[f] );
		}
		renderer.SetTileSource(sourceId, imageSource);
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

	var dialogControl = null;
	function UpdateDialogControl(isVisible) {
		controls.dialogControl.style.display = isVisible ? "block" : "none";

		if (!dialogControl) {
			dialogControl = new DialogControl("paintPanel");
			controls.dialogControl.appendChild(dialogControl.GetElement());
		}

		dialogControl.SetDrawing(drawingId);

		// todo : refactor?
		// if (alwaysShowDrawingDialog && dialog[til.dlg]) {
		// 	events.Raise("select_dialog", { id: til.dlg, insertNextToId: null, showIfHidden: false });
		// }
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
		if (ANIMATION_SIZE != null && tile[drawingId].animation.frameCount >= ANIMATION_SIZE) {
			return;
		}

		// copy last frame data into new frame
		var prevFrameIndex = tile[drawingId].animation.frameCount - 1;
		var imageSource = renderer.GetTileSource(drawingId);
		var prevFrame = imageSource[prevFrameIndex];
		var newFrame = [];
		for (var y = 0; y < tilesize; y++) {
			newFrame.push([]);
			for (var x = 0; x < tilesize; x++) {
				newFrame[y].push(prevFrame[y][x]);
			}
		}
		imageSource.push(newFrame);
		renderer.SetTileSource(drawingId, imageSource);

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

		updateFrameControls();
	}

	function updateFrameControls() {
		controls.removeButton.style.display =
			tile[drawingId].animation.frameCount > 1 ? "inline-block" : "none";

		controls.addButton.style.display =
			(ANIMATION_SIZE != null && tile[drawingId].animation.frameCount >= ANIMATION_SIZE) ?
				"none" : "inline-block";
	}

	controls.addButton.onclick = addNewFrameToDrawing;

	function removeLastFrameFromDrawing() {
		if (tile[drawingId].animation.frameCount <= 1) {
			return;
		}

		// remove last frame!
		var imageSource = renderer.GetTileSource(drawingId);
		renderer.SetTileSource(drawingId, imageSource.slice(0, imageSource.length - 1));

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

		updateFrameControls();
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

		updateFrameControls();
	}

	this.RefreshCurFrame = function() {
		refreshFrame(frameIndex);
	}

	this.RefreshAll = function() {
		refreshFrame();
	}
}

function ColorSettingsControl(controls, onColorChange) {
	var drawingId = null;

	this.Update = function(id) {
		drawingId = id;
		var isVisible = true; // todo
		UpdateControls(isVisible);
		return isVisible;
	}

	function UpdateControls(isVisible) {
		if (isVisible) {
			controls.colorContainer.style.display = "flex";

			if (tile[drawingId].col >= 0 && tile[drawingId].col < 3) {
				controls.colorSelect.value = tile[drawingId].col;
				controls.colorIndexInput.style.display = "none";
			}
			else {
				controls.colorSelect.value = "other";
				controls.colorIndexInput.style.display = "flex";
				controls.colorIndexInput.value = tile[drawingId].col;
			}
		}
		else {
			controls.colorContainer.style.display = "none";
		}
	}

	controls.colorSelect.onchange = function(e) {
		if (e.target.value === "other") {
			controls.colorIndexInput.style.display = "flex";
			controls.colorIndexInput.value = tile[drawingId].col;
		}
		else {
			controls.colorIndexInput.style.display = "none";
			tile[drawingId].col = parseInt(e.target.value);

			refreshGameData();

			if (onColorChange) {
				onColorChange();
			}
		}
	}

	controls.colorIndexInput.onchange = function(e) {
		tile[drawingId].col = parseInt(e.target.value);

		refreshGameData();

		if (onColorChange) {
			onColorChange();
		}
	}
}

function WallSettingsControl(controls) {
	var drawingId = null;

	this.Update = function(id) {
		drawingId = id;
		var isVisible = tile[drawingId].type === TYPE_KEY.TILE;
		UpdateWallSettingsControl(isVisible);
		return isVisible;
	}

	function UpdateWallSettingsControl(isVisible) {
		// wall UI
		if (isVisible) {
			hasSettings = true;
			controls.container.setAttribute("style", "display:flex;");
			updateWallCheckboxOnCurrentTile();
		}
		else {
			controls.container.setAttribute("style", "display:none;");
		}
	}

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
			controls.checkbox.checked = true;
			iconUtils.LoadIcon(controls.icon, "wall_on");
			controls.text.innerText = "yes "; // todo : localize
		}
		else {
			controls.checkbox.checked = false;
			iconUtils.LoadIcon(controls.icon, "wall_off");
			controls.text.innerText = "no "; // todo : localize
		}
	}

	function ToggleWall(checked) {
		if (tile[drawingId].type != TYPE_KEY.TILE) {
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

		updateWallCheckboxOnCurrentTile();
	}

	controls.checkbox.onchange = function(e) {
		ToggleWall(e.target.checked);
	};
}

function InventorySettingsControl(controls) {
	var drawingId = null;

	this.Update = function(id) {
		drawingId = id;
		var isVisible = tile[drawingId].type === TYPE_KEY.ITEM;
		UpdateInventorySettings(isVisible);
		return isVisible;
	}

	events.Listen("item_inventory_change", function(e) {
		if (e.id === drawingId) {
			controls.input.value = e.count;
		}
	});

	function UpdateInventorySettings(isVisible) {
		if (isVisible) {
			hasSettings = true;

			controls.container.setAttribute("style", "display:flex;");

			var itemCount = drawingId in tile[playerId].inventory ? tile[playerId].inventory[drawingId] : 0;

			controls.input.value = itemCount;

			controls.input.oninput = function(e) {
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
			controls.container.setAttribute("style", "display:none;");
		}
	}
}

function ExitSettingsControl(controls) {
	var drawingId = null;

	this.Update = function(id) {
		drawingId = id;
		var isVisible = tile[drawingId].type === TYPE_KEY.EXIT;
		UpdateExitSettingControls(isVisible);
		return isVisible;
	}

	// exit transition controls
	controls.transitionSelect.onchange = function(e) {
		if (tile[drawingId].type === TYPE_KEY.EXIT) {
			if (e.target.value === "none") {
				tile[drawingId].transition_effect = null;
			}
			else {
				tile[drawingId].transition_effect = e.target.value;
			}

			refreshGameData();
		}
	};

	// exit destination controls
	var exitRoomSelect;

	controls.editToggle.onchange = function(e) {
		controls.room.style.display = e.target.checked ? "flex" : "none";
		controls.pos.style.display = e.target.checked ? "flex" : "none";
	};

	var onMove = null;
	controls.moveToggle.onchange = function(e) {
		if (e.target.checked) {
			if (roomTool) {
				onMove = roomTool.OnSelectLocation(
					function(roomId, x, y) {
						tile[drawingId].dest.room = roomId;
						tile[drawingId].dest.x = x;
						tile[drawingId].dest.y = y;

						UpdateExitSettingControls(true);

						refreshGameData();
					},
					function() {
						controls.moveToggle.checked = false;
						onMove = null;
					});
			}
		}
		else if (onMove != null) {
			onMove.OnFinish();
		}
	}

	controls.xInput.onchange = function(e) {
		tile[drawingId].dest.x = e.target.value;
		UpdateExitDescription();
		refreshGameData();
	};

	controls.yInput.onchange = function(e) {
		tile[drawingId].dest.y = e.target.value;
		UpdateExitDescription();
		refreshGameData();
	};

	function UpdateExitDescription() {
		console.log(drawingId);

		// todo : localize
		controls.description.innerText = "exit to " + 
			findTool.GetDisplayName("room", tile[drawingId].dest.room) + 
			" (" + tile[drawingId].dest.x + ", " + tile[drawingId].dest.y + ")";
	}

	function UpdateExitSettingControls(isVisible) {
		controls.destination.style.display = isVisible ? "block" : "none";
		controls.transitionEffect.style.display = isVisible ? "flex" : "none";

		if (!exitRoomSelect && findTool) {
			exitRoomSelect = findTool.CreateSelectControl(
				"room",
				{
					onSelectChange : function(id) {
						tile[drawingId].dest.room = id;
						UpdateExitDescription();
						refreshGameData();
					},
					toolId : "paintPanel",
					getSelectMessage : function() {
						// todo : localize
						return "select destination room for " + findTool.GetDisplayName("drawing", drawingId) + "...";
					},
				});

			controls.roomSelect.appendChild(exitRoomSelect.GetElement());
		}

		if (isVisible) {
			UpdateExitDescription();

			controls.room.style.display = controls.editToggle.checked ? "flex" : "none";
			controls.pos.style.display = controls.editToggle.checked ? "flex" : "none";

			if (exitRoomSelect) {
				exitRoomSelect.SetSelection(tile[drawingId].dest.room);
			}

			controls.xInput.value = tile[drawingId].dest.x;
			controls.yInput.value = tile[drawingId].dest.y;

			var effectId = tile[drawingId].transition_effect ? tile[drawingId].transition_effect : "none";
			controls.transitionSelect.value = effectId;
		}
	}
}

function LockSettingsControl(controls) {
	var drawingId = null;
	var lockItemSelect;
	var UpdateLockSettingControls;

	this.Update = function(id) {
		drawingId = id;
		var isVisible = tile[drawingId].type === TYPE_KEY.EXIT || tile[drawingId].type === TYPE_KEY.ENDING;

		UpdateLockSettingControls(isVisible);

		return isVisible;
	};

	events.Listen("add_drawing", function() {
		if (lockItemSelect) {
			lockItemSelect.UpdateOptions();
		}
	});

	events.Listen("delete_drawing", function() {
		if (lockItemSelect) {
			lockItemSelect.UpdateOptions();
		}
	});

	UpdateLockSettingControls = function (isVisible) {
		if (!lockItemSelect && findTool) {
			lockItemSelect = findTool.CreateSelectControl(
				"drawing",
				{
					onSelectChange : function(id) {
						tile[drawingId].lockItem = id;
						refreshGameData();
					},
					filters : ["item"],
					toolId : "paintPanel",
					getSelectMessage : function() {
						// todo : localize
						return "select lock item for " + findTool.GetDisplayName("drawing", drawingId) + "...";
					},
					// showDropdown : false, // todo : show or not?
				});

			controls.itemInput.appendChild(lockItemSelect.GetElement());

			controls.tollInput.onchange = function(e) {
				if (tile[drawingId].type === "EXT" || tile[drawingId].type === "END") {
					tile[drawingId].lockToll = e.target.value;

					if (e.target.value < 1) {
						controls.typeSelect.value = 0;
						UpdateLockSettingControls(true);
					}

					refreshGameData();
				}
			};

			controls.typeSelect.onchange = function(e) {
				if (e.target.value > -1) {
					tile[drawingId].lockToll = e.target.value;

					if (tile[drawingId].lockItem === null) {
						// todo : how to pick the starting item?
						tile[drawingId].lockItem = "1";
					}
				}
				else {
					tile[drawingId].lockToll = 0;
					tile[drawingId].lockItem = null;
				}

				UpdateLockSettingControls(true);

				refreshGameData();
			}
		}

		if (!isVisible) {
			controls.container.style.display = "none";
		}
		else {
			controls.container.style.display = "flex";

			if (tile[drawingId].lockItem === null) {
				controls.typeSelect.value = -1;
				controls.itemInput.style.display = "none";
				controls.tollContainer.style.display = "none";
			}
			else {
				controls.typeSelect.value = Math.min(1, tile[drawingId].lockToll);

				controls.tollContainer.style.display =
					tile[drawingId].lockToll <= 0 ? "none" : "inline";
				controls.tollInput.value = tile[drawingId].lockToll;

				controls.itemInput.style.display = "inline";
				if (lockItemSelect) {
					lockItemSelect.SetSelection(tile[drawingId].lockItem);
				}
			}
		}
	}
}