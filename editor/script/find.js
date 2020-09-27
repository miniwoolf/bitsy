/*
TODO
- test out performance for large games
- hide default palette
*/

function FindTool(controls) {
	var searchText = controls.searchInput.value;
	var activeFilters = [];

	controls.searchInput.onchange = function(e) {
		searchText = e.target.value;
		events.Raise("change_find_filter", { searchText: searchText, activeFilters: activeFilters });
	}

	controls.filterRoot.style.display = controls.filterVisibleCheck.checked ? "block" : "none";
	controls.filterVisibleCheck.onchange = function(e) {
		controls.filterRoot.style.display = e.target.checked ? "block" : "none";
	}

	function CreateFilterToggleHandler(filterId, filterCheck) {
		if (filterCheck.checked) {
			activeFilters.push(filterId);
		}

		filterCheck.onchange = function(e) {
			if (e.target.checked) {
				activeFilters.push(filterId);
			}
			else {
				activeFilters.splice(activeFilters.indexOf(filterId), 1);
			}

			events.Raise("change_find_filter", { searchText: searchText, activeFilters: activeFilters });
		}
	}

	CreateFilterToggleHandler("avatar", controls.filterAvatarCheck);
	CreateFilterToggleHandler("tile", controls.filterTileCheck);
	CreateFilterToggleHandler("sprite", controls.filterSpriteCheck);
	CreateFilterToggleHandler("item", controls.filterItemCheck);
	CreateFilterToggleHandler("exit", controls.filterExitCheck);
	CreateFilterToggleHandler("ending", controls.filterEndingCheck);
	CreateFilterToggleHandler("room", controls.filterRoomCheck);
	CreateFilterToggleHandler("map", controls.filterMapCheck);
	CreateFilterToggleHandler("palette", controls.filterPaletteCheck);
	CreateFilterToggleHandler("dialog", controls.filterDialogCheck);

	CreateFilterToggleHandler("cur_room", controls.filterCurRoomCheck);
	var onRoomChangeUpdateFilter = function() {
		if (activeFilters.indexOf("cur_room") != -1) {
			events.Raise("change_find_filter", { searchText: searchText, activeFilters: activeFilters });
		}
	};
	events.Listen("select_room", onRoomChangeUpdateFilter);
	events.Listen("change_room", onRoomChangeUpdateFilter);
	events.Listen("change_room_palette", onRoomChangeUpdateFilter);

	AddCategory({
		name: "drawing",
		engineObjectStore: object,
		// todo : store in category object?
		getCaption: function(obj) {
			var caption = "";

			if (obj.name != null) {
				caption = obj.name;
			}
			else {
				if (obj.type === "SPR" && obj.id === "A") {
					caption = localization.GetStringOrFallback("avatar_label", "avatar");
				}
				else if (obj.type === "TIL") {
					caption = localization.GetStringOrFallback("tile_label", "tile") + " " + obj.id;
				}
				else if (obj.type === "SPR") {
					caption = localization.GetStringOrFallback("sprite_label", "sprite") + " " + obj.id;
				}
				else if (obj.type === "ITM") {
					caption = localization.GetStringOrFallback("item_label", "item") + " " + obj.id;
				}
				// todo : localize
				else if (obj.type === "EXT") {
					caption = "exit " + obj.id;
				}
				else if (obj.type === "END") {
					caption = "ending " + obj.id; // todo : word too long?
				}
			}

			return caption;
		},
		getIconId: function(obj) {
			var iconId = "tile";

			if (obj.type === "SPR") {
				iconId = obj.id === "A" ? "avatar" : "sprite";
			}
			else if (obj.type === "ITM") {
				iconId = "item";
			}
			else if (obj.type === "EXT") {
				iconId = "exit_one_way"; // todo : right icon for this?
			}
			else if (obj.type === "END") {
				iconId = "ending";
			}

			return iconId;
		},
		includedInFilter: function(obj) {
			var result = false;

			if (obj.type === "SPR") {
				result = activeFilters.indexOf(obj.id === "A" ? "avatar" : "sprite") != -1;
			}
			else if (obj.type === "TIL") {
				result = activeFilters.indexOf("tile") != -1;
			}
			else if (obj.type === "ITM") {
				result = activeFilters.indexOf("item") != -1;
			}
			else if (obj.type === "EXT") {
				result = activeFilters.indexOf("exit") != -1;
			}
			else if (obj.type === "END") {
				result = activeFilters.indexOf("ending") != -1;
			}

			if (result && activeFilters.indexOf("cur_room") != -1) {
				if (obj.type === "TIL") {
					var tileInRoom = false;

					for (var y = 0; y < roomsize; y++) {
						for (var x = 0; x < roomsize; x++) {
							if (room[curRoom].tilemap[y][x] === obj.id) {
								tileInRoom = true;
							}
						}
					}

					result = tileInRoom;
				}
				else {
					var objInRoom = false;

					for (var i = 0; i < room[curRoom].objects.length; i++) {
						if (room[curRoom].objects[i].id === obj.id) {
							objInRoom = true;
						}
					}

					result = objInRoom;
				}
			}

			return result;
		},
		selectEventId: "select_drawing",
		toolId: "paintPanel",
		addEventId: "add_drawing",
		deleteEventId: "delete_drawing",
		refreshThumbEventIdList: ["change_drawing"],
		refreshAllThumbsEventIdList: ["change_room_palette", "select_room"],
		changeNameEventId: "change_drawing_name",
		thumbnailRenderer: CreateDrawingThumbnailRenderer(),
		getRenderOptions: function(obj) {
			return {
				isAnimated : obj.animation.isAnimated,
				frameIndex : 0,
			};
		},
	});

	AddCategory({
		name: "room",
		engineObjectStore: room,
		getCaption: function(obj) { return obj.name ? obj.name : "room " + obj.id; }, // TODO : localize
		getIconId: function(obj) { return "room"; },
		includedInFilter: function(obj) { 
			var result = activeFilters.indexOf("room") != -1;

			if (result && activeFilters.indexOf("cur_room") != -1) {
				result = obj.id === curRoom;
			}

			return result;
		},
		selectEventId: "select_room",
		toolId: "roomPanel",
		addEventId: "add_room",
		deleteEventId: "delete_room",
		changeNameEventId: "change_room_name",
		// todo : this isn't working if the palette changes when you have a different room selected
		// is there a smarter way to set this up??
		refreshThumbEventIdList: ["change_room", "change_room_palette"],
		thumbnailRenderer: CreateRoomThumbnailRenderer(),
	});

	AddCategory({
		name: "map",
		engineObjectStore: map,
		getCaption: function(obj) { return obj.name ? obj.name : "map " + obj.id; }, // TODO : localize
		getIconId: function(obj) { return "room"; }, // TODO : real icon
		includedInFilter: function(obj) {
			return activeFilters.indexOf("cur_room") === -1 && activeFilters.indexOf("map") != -1;
		},
		selectEventId: "select_map",
		toolId: "mapPanel",
		addEventId: "add_map",
		deleteEventId: "delete_map",
		changeNameEventId: "change_map_name",
		// todo : this list might be overkill
		refreshAllThumbsEventIdList: ["change_map", "change_room_palette", "palette_change"],
		thumbnailRenderer: CreateMapThumbnailRenderer(),
	});

	AddCategory({
		name: "palette",
		engineObjectStore: palette,
		getCaption: function(obj) { return obj.name ? obj.name : "palette " + obj.id; }, // TODO : localize
		getIconId: function(obj) { return "colors"; },
		includedInFilter: function(obj) {
			var result = activeFilters.indexOf("palette") != -1;

			if (result && activeFilters.indexOf("cur_room") != -1) {
				result = obj.id === room[curRoom].pal;
			}

			return result;
		},
		selectEventId: "select_palette",
		toolId: "colorsPanel",
		addEventId: "add_palette",
		deleteEventId: "delete_palette",
		changeNameEventId: "change_palette_name",
		refreshThumbEventIdList: ["palette_change"],
		thumbnailRenderer: CreatePaletteThumbnailRenderer(),
	});

	AddCategory({
		name: "dialog",
		engineObjectStore: dialog,
		getCaption: function(obj) { return obj.name ? obj.name : "dialog " + obj.id; }, // TODO : localize
		getIconId: function(obj) { return "dialog"; },
		includedInFilter: function(obj) {
			return activeFilters.indexOf("cur_room") === -1 && activeFilters.indexOf("dialog") != -1;
		},
		selectEventId: "select_dialog",
		toolId: "dialogPanel",
		// TODO : add & delete
		changeNameEventId: "change_dialog_name",
	});

	function AddCategory(categoryInfo) {
		var categoryDiv = document.createElement("div");
		categoryDiv.classList.add("findCategory");
		controls.contentRoot.appendChild(categoryDiv);

		var thumbCache = {};

		var selectedId = null;

		function createOnClick(id) {
			return function() {
				if (id === selectedId) {
					showPanel(categoryInfo.toolId, "findPanel");
				}
				else {
					events.Raise(categoryInfo.selectEventId, { id: id });
				}
			};
		};

		function getThumbId(id) {
			return "find_" + categoryInfo.name + "_" + id;
		}

		function getThumbImgId(id) {
			return getThumbId(id) + "_img";
		}

		function getThumbNameTextId(id) {
			return getThumbId(id) + "_name";
		}

		function addThumbToCategory(id) {
			var engineObject = categoryInfo.engineObjectStore[id];

			var thumbDiv = CreateThumbnail(
				getThumbId(id),
				getThumbImgId(id),
				getThumbNameTextId(id),
				engineObject,
				categoryInfo.getCaption(engineObject),
				categoryInfo.getIconId(engineObject),
				createOnClick(id),
				categoryInfo.thumbnailRenderer != undefined);

			thumbCache[engineObject.id] = thumbDiv;

			categoryDiv.appendChild(thumbDiv);

			renderThumbnail(id);
		}

		function removeThumbFromCategory(id) {
			categoryDiv.removeChild(document.getElementById(getThumbId(id)));
		}

		function refreshThumbs() {
			categoryDiv.innerHTML = "";

			for (id in categoryInfo.engineObjectStore) {
				addThumbToCategory(id);
			}
		}

		function renderThumbnail(id) {
			if (categoryInfo.thumbnailRenderer) {
				var thumbImg = document.getElementById(getThumbImgId(id));

				var onRenderFinish = function(uri) {
					thumbImg.src = uri;
					thumbImg.parentNode.classList.add("findToolThumbnailRendered");
				}

				var options = {};
				if (categoryInfo.getRenderOptions) {
					options = categoryInfo.getRenderOptions(categoryInfo.engineObjectStore[id]);
				}

				categoryInfo.thumbnailRenderer.Render(id, onRenderFinish, options);
			}
		}

		function updateVisibility() {
			for (var id in categoryInfo.engineObjectStore) {
				var engineObject = categoryInfo.engineObjectStore[id];
				var caption = categoryInfo.getCaption(engineObject);
				var includedInSearch = searchText === null || searchText.length <= 0 || caption.indexOf(searchText) != -1;
				var isVisible = includedInSearch && categoryInfo.includedInFilter(engineObject);
				// todo : switch to use a style?
				document.getElementById(getThumbId(id)).style.display = isVisible ? "inline-block" : "none";
			}
		}

		events.Listen(categoryInfo.selectEventId, function(e) {
			selectedId = e.id;

			for (id in thumbCache) {
				if (id === selectedId) {
					thumbCache[id].classList.add("selected");
				}
				else {
					thumbCache[id].classList.remove("selected");
				}
			}
		});

		if (categoryInfo.addEventId) {
			events.Listen(categoryInfo.addEventId, function(e) {
				addThumbToCategory(e.id);
			});
		}

		if (categoryInfo.deleteEventId) {
			events.Listen(categoryInfo.deleteEventId, function(e) {
				removeThumbFromCategory(e.id);
			});
		}

		if (categoryInfo.refreshThumbEventIdList) {
			var onRefreshThumb = function(e) {
				renderThumbnail(e.id);
			}

			for (var i = 0; i < categoryInfo.refreshThumbEventIdList.length; i++) {
				var eventId = categoryInfo.refreshThumbEventIdList[i];
				events.Listen(eventId, onRefreshThumb);
			}
		}

		if (categoryInfo.refreshAllThumbsEventIdList) {
			var onRefreshAllThumbImages = function() {
				for (id in categoryInfo.engineObjectStore) {
					renderThumbnail(id);
				}
			}

			for (var i = 0; i < categoryInfo.refreshAllThumbsEventIdList.length; i++) {
				var eventId = categoryInfo.refreshAllThumbsEventIdList[i];
				events.Listen(eventId, onRefreshAllThumbImages);
			}
		}

		if (categoryInfo.changeNameEventId) {
			events.Listen(categoryInfo.changeNameEventId, function(e) {
				// todo : kind of duplicative
				var engineObject = categoryInfo.engineObjectStore[e.id];
				var caption = categoryInfo.getCaption(engineObject);

				var nameText = document.getElementById(getThumbNameTextId(e.id));
				nameText.innerText = caption;

				if (engineObject.name === undefined || engineObject.name === null) {
					nameText.classList.add("thumbnailDefaultName");
				}
				else {
					nameText.classList.remove("thumbnailDefaultName");
				}
			});
		}

		events.Listen("game_data_change", function() {
			refreshThumbs();
		});

		events.Listen("change_find_filter", function() {
			updateVisibility();
		});

		// init category
		refreshThumbs();
	}

	function CreateThumbnail(thumbId, thumbImgId, thumbNameTextId, engineObject, caption, iconId, onClick, hasRenderer) {
		var div = document.createElement("div");
		div.id = thumbId;
		div.classList.add("findToolItem");

		var thumbnail = document.createElement("div");
		thumbnail.classList.add("findToolThumbnail");
		thumbnail.appendChild(iconUtils.CreateIcon(iconId));
		thumbnail.onclick = onClick;

		if (hasRenderer) {
			var img = document.createElement("img");
			img.id = thumbImgId;
			thumbnail.appendChild(img);
		}

		div.appendChild(thumbnail);

		// create caption
		var nameCaption = document.createElement("figcaption");
		nameCaption.appendChild(iconUtils.CreateIcon(iconId));

		var nameText = document.createElement("span");
		nameText.id = thumbNameTextId;
		nameText.innerText = caption;

		if (engineObject.name === undefined || engineObject.name === null) {
			nameText.classList.add("thumbnailDefaultName");
		}

		nameCaption.appendChild(nameText);

		div.appendChild(nameCaption);

		return div;
	}

	events.Raise("change_find_filter", { searchText: searchText, activeFilters: activeFilters });
}

function ThumbnailRenderer(getRenderObject, getHexPalette, onRender) {
	var drawingThumbnailCanvas, drawingThumbnailCtx;
	drawingThumbnailCanvas = document.createElement("canvas");
	drawingThumbnailCanvas.width = 8 * scale; // TODO: scale constants need to be contained somewhere
	drawingThumbnailCanvas.height = 8 * scale;
	drawingThumbnailCtx = drawingThumbnailCanvas.getContext("2d");

	var thumbnailRenderEncoders = {};
	var cache = {};

	function render(id, callback, options) {
		var renderObj = getRenderObject(id);
		var hexPalette = getHexPalette(renderObj);
		var drawingFrameData = onRender(renderObj, drawingThumbnailCtx, options);

		// create encoder
		var gifData = {
			frames: drawingFrameData,
			width: drawingThumbnailCanvas.width,
			height: drawingThumbnailCanvas.height,
			palette: hexPalette,
			loops: 0,
			delay: animationTime / 10, // TODO why divide by 10???
		};
		var encoder = new gif();

		// cancel old encoder (if in progress already)
		if (thumbnailRenderEncoders[id] != null) {
			thumbnailRenderEncoders[id].cancel();
		}
		thumbnailRenderEncoders[id] = encoder;

		// start encoding new GIF
		encoder.encode(gifData, function(uri) {
			// update cache
			cache[id] = {
				uri : uri,
				outOfDate : false
			};

			callback(uri);
		});
	}
	this.Render = render;

	this.GetCacheEntry = function(id) {
		if (!cache[id]) {
			cache[id] = {
				uri : null,
				outOfDate : true
			};
		}

		return cache[id];
	}
} // ThumbnailRenderer()

function CreateDrawingThumbnailRenderer() {
	var getRenderObject = function(id) {
		return object[id];
	}

	var getHexPalette = function(obj) {
		var palId = getRoomPal(curRoom);

		var hexPalette = [];
		var roomColors = getPal(palId);
		for (i in roomColors) {
			var hexStr = rgbToHex(roomColors[i][0], roomColors[i][1], roomColors[i][2]).slice(1);
			hexPalette.push(hexStr);
		}

		return hexPalette;
	}

	var onRender = function(obj, ctx, options) {
		var palId = getRoomPal(curRoom);
		var drawingFrameData = [];

		// todo : more than two frames?
		if (options.isAnimated || options.frameIndex == 0) {
			drawObject(renderer.GetImage(obj, palId, 0 /*frameIndex*/), 0, 0, ctx);
			drawingFrameData.push(ctx.getImageData(0, 0, 8 * scale, 8 * scale).data);
		}

		if (options.isAnimated || options.frameIndex == 1) {
			drawObject(renderer.GetImage(obj, palId, 1 /*frameIndex*/), 0, 0, ctx);
			drawingFrameData.push(ctx.getImageData(0, 0, 8 * scale, 8 * scale).data);
		}

		return drawingFrameData;
	}

	return new ThumbnailRenderer(getRenderObject, getHexPalette, onRender);
}

function CreateRoomThumbnailRenderer() {
	var getRenderObject = function(id) {
		return room[id];
	}

	var getHexPalette = function(obj) {
		var palId = obj.pal;

		var hexPalette = [];
		var roomColors = getPal(palId);
		for (i in roomColors) {
			var hexStr = rgbToHex(roomColors[i][0], roomColors[i][1], roomColors[i][2]).slice(1);
			hexPalette.push(hexStr);
		}

		return hexPalette;		
	}

	var onRender = function(obj, ctx, options) {
		mapTool.DrawMiniRoom(obj.id, 0, 0, 8 * scale, ctx);
		return [ctx.getImageData(0, 0, 8 * scale, 8 * scale).data];
	}

	return new ThumbnailRenderer(getRenderObject, getHexPalette, onRender);
}

function CreatePaletteThumbnailRenderer() {
	var getRenderObject = function(id) {
		return palette[id];
	}

	var getHexPalette = function(obj) {
		var palId = obj.id;

		var hexPalette = [];
		var colors = getPal(palId);
		for (i in colors) {
			var hexStr = rgbToHex(colors[i][0], colors[i][1], colors[i][2]).slice(1);
			hexPalette.push(hexStr);
		}

		return hexPalette;		
	}

	var onRender = function(obj, ctx, options) {
		var hexPalette = getHexPalette(obj);

		ctx.fillStyle = "black";
		ctx.fillRect(0, 0, 8 * scale, 8 * scale);

		ctx.fillStyle = "#" + hexPalette[0];
		ctx.fillRect(1 * scale, 1 * scale, 6 * scale, 2 * scale);

		ctx.fillStyle = "#" + hexPalette[1];
		ctx.fillRect(1 * scale, 3 * scale, 6 * scale, 2 * scale);

		ctx.fillStyle = "#" + hexPalette[2];
		ctx.fillRect(1 * scale, 5 * scale, 6 * scale, 2 * scale);

		return [ctx.getImageData(0, 0, 8 * scale, 8 * scale).data];
	}

	return new ThumbnailRenderer(getRenderObject, getHexPalette, onRender);
}

function CreateMapThumbnailRenderer() {
	var getRenderObject = function(id) {
		return map[id];
	}

	var hexColorMap;

	// todo : probably bad practice to generate the hex color map as a side effect but oh well
	var getHexPalette = function(obj) {
		console.log(obj);

		hexColorMap = {
			"0" : "#000000",
		};

		for (var y = 0; y < mapsize; y++) {
			for (var x = 0; x < mapsize; x++) {
				var roomId = obj.map[y][x];
				if (roomId != "0" && roomId in room) {
					var palId = room[roomId].pal;
					var palColors = getPal(palId);
					var hexStr = rgbToHex(palColors[0][0], palColors[0][1], palColors[0][2]);
					hexColorMap[roomId] = hexStr;
				}
			}
		}

		var hexPalette = [];
		for (id in hexColorMap) {
			hexPalette.push(hexColorMap[id].slice(1));
		}

		return hexPalette;
	}

	var onRender = function(obj, ctx, options) {
		ctx.fillStyle = hexColorMap["0"];
		ctx.fillRect(0, 0, 8 * scale, 8 * scale);

		for (var y = 0; y < mapsize; y++) {
			for (var x = 0; x < mapsize; x++) {
				var roomId = obj.map[y][x];
				if (roomId != "0" && roomId in room) {
					var hexStr = hexColorMap[roomId];
					ctx.fillStyle = hexStr;
					ctx.fillRect(x * scale, y * scale, 1 * scale, 1 * scale);
				}
			}
		}

		return [ctx.getImageData(0, 0, 8 * scale, 8 * scale).data];
	}

	return new ThumbnailRenderer(getRenderObject, getHexPalette, onRender);
}