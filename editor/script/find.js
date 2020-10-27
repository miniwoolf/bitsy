/*
TODO
- test out performance for large games
- hide default palette
- get rid of old explorer.js
*/

function FindTool(controls) {
	var searchText = controls.searchInput.value;
	var activeFilters = [];
	var categories = {};

	this.GetIconId = function(categoryName, id) {
		var category = categories[categoryName];
		return category.getIconId(category.categoryStore[id]);
	};

	// todo : is forceDefault *really* how I want to do this?
	this.GetDisplayName = function(categoryName, id, forceDefault) {
		var category = categories[categoryName];
		return category.getCaption(category.categoryStore[id], forceDefault);
	};

	// keep UI in sync
	events.Listen("change_find_filter", function(e) {
		if (searchText != e.searchText) {
			searchText = e.searchText;
			controls.searchInput.value = searchText;
		}

		if (activeFilters.toString() != e.activeFilters.toString()) {
			activeFilters = e.activeFilters;
		}
	});

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

		events.Listen("change_find_filter", function(e) {
			filterCheck.checked = e.activeFilters.indexOf(filterId) != -1;
		});
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
		categoryStore: tile,
		// todo : store in category object?
		getCaption: function(til, forceDefault) {
			var caption = "";

			if (til.name != null && !forceDefault) {
				caption = til.name;
			}
			else {
				if (til.type === "SPR" && til.id === "A") {
					caption = localization.GetStringOrFallback("avatar_label", "avatar");
				}
				else if (til.type === "TIL") {
					caption = localization.GetStringOrFallback("tile_label", "tile") + " " + til.id;
				}
				else if (til.type === "SPR") {
					caption = localization.GetStringOrFallback("sprite_label", "sprite") + " " + til.id;
				}
				else if (til.type === "ITM") {
					caption = localization.GetStringOrFallback("item_label", "item") + " " + til.id;
				}
				// todo : localize
				else if (til.type === "EXT") {
					caption = "exit " + til.id;
				}
				else if (til.type === "END") {
					caption = "ending " + til.id; // todo : word too long?
				}
			}

			return caption;
		},
		getIconId: function(til) {
			var iconId = "tile";

			if (til.type === "SPR") {
				iconId = til.id === "A" ? "avatar" : "sprite";
			}
			else if (til.type === "ITM") {
				iconId = "item";
			}
			else if (til.type === "EXT") {
				iconId = "exit_one_way"; // todo : right icon for this?
			}
			else if (til.type === "END") {
				iconId = "ending";
			}

			return iconId;
		},
		includedInFilter: function(til, filters) {
			var result = false;

			if (til.type === "SPR") {
				result = filters.indexOf(til.id === "A" ? "avatar" : "sprite") != -1;
			}
			else if (til.type === "TIL") {
				result = filters.indexOf("tile") != -1;
			}
			else if (til.type === "ITM") {
				result = filters.indexOf("item") != -1;
			}
			else if (til.type === "EXT") {
				result = filters.indexOf("exit") != -1;
			}
			else if (til.type === "END") {
				result = filters.indexOf("ending") != -1;
			}

			if (result && filters.indexOf("cur_room") != -1) {
				if (til.type === "TIL") {
					var tileInRoom = false;

					for (var y = 0; y < roomsize; y++) {
						for (var x = 0; x < roomsize; x++) {
							if (room[curRoom].tilemap[y][x] === til.id) {
								tileInRoom = true;
							}
						}
					}

					result = tileInRoom;
				}
				else {
					var sprInRoom = false;

					for (var i = 0; i < room[curRoom].sprites.length; i++) {
						if (room[curRoom].sprites[i].id === til.id) {
							sprInRoom = true;
						}
					}

					result = sprInRoom;
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
		getRenderOptions: function(til) {
			return {
				isAnimated : til.animation.isAnimated,
				frameIndex : 0,
			};
		},
	});

	AddCategory({
		name: "room",
		categoryStore: room,
		getCaption: function(r) { return r.name ? r.name : "room " + r.id; }, // TODO : localize
		getIconId: function(r) { return "room"; },
		includedInFilter: function(r, filters) { 
			var result = filters.indexOf("room") != -1;

			if (result && filters.indexOf("cur_room") != -1) {
				result = r.id === curRoom;
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
		categoryStore: map,
		getCaption: function(m) { return m.name ? m.name : "map " + m.id; }, // TODO : localize
		getIconId: function(m) { return "room"; }, // TODO : real icon
		includedInFilter: function(m, filters) {
			return filters.indexOf("cur_room") === -1 && filters.indexOf("map") != -1;
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
		categoryStore: palette,
		getCaption: function(pal) { return pal.name ? pal.name : "palette " + pal.id; }, // TODO : localize
		getIconId: function(pal) { return "colors"; },
		includedInFilter: function(pal, filters) {
			var result = filters.indexOf("palette") != -1;

			if (result && filters.indexOf("cur_room") != -1) {
				result = pal.id === room[curRoom].pal;
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
		categoryStore: dialog,
		getCaption: function(dlg) {
			if (dlg.id === titleDialogId) {
				// todo : localize?
				return titleDialogId;
			}
			else {
				return dlg.name ? dlg.name : "dialog " + dlg.id;
			}
		}, // TODO : localize
		getIconId: function(dlg) { return "dialog"; },
		includedInFilter: function(dlg, filters) {
			return (filters.indexOf("cur_room") === -1
				&& filters.indexOf("dialog") != -1
				&& (dlg.id != titleDialogId || filters.indexOf("no_title") === -1));
		},
		selectEventId: "select_dialog",
		toolId: "dialogPanel",
		// TODO : add & delete
		changeNameEventId: "change_dialog_name",
	});

	function AddCategory(categoryInfo) {
		categories[categoryInfo.name] = categoryInfo;

		var categoryDiv = document.createElement("div");
		categoryDiv.classList.add("findCategory");
		controls.contentRoot.appendChild(categoryDiv);

		var thumbCache = {};

		var selectedId = null;

		function createOnClick(id) {
			return function() {
				if (isSelectMode) {
					selectChoiceId = id; // todo : redundant?
					onSelectFunc(selectChoiceId);
				}
				else if (id === selectedId) {
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
			var categoryItem = categoryInfo.categoryStore[id];

			var thumbDiv = CreateThumbnail(
				getThumbId(id),
				getThumbImgId(id),
				getThumbNameTextId(id),
				categoryItem,
				categoryInfo.getCaption(categoryItem),
				categoryInfo.getIconId(categoryItem),
				createOnClick(id),
				categoryInfo.thumbnailRenderer != undefined);

			thumbCache[categoryItem.id] = thumbDiv;

			categoryDiv.appendChild(thumbDiv);

			renderThumbnail(id);
		}

		function removeThumbFromCategory(id) {
			console.log(id);
			console.log(getThumbId(id));
			categoryDiv.removeChild(document.getElementById(getThumbId(id)));
		}

		function refreshThumbs() {
			categoryDiv.innerHTML = "";

			for (id in categoryInfo.categoryStore) {
				var isExcluded = categoryInfo.idExclusionList && categoryInfo.idExclusionList.indexOf(id) != -1;

				if (!isExcluded) {
					addThumbToCategory(id);
				}
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
					options = categoryInfo.getRenderOptions(categoryInfo.categoryStore[id]);
				}

				categoryInfo.thumbnailRenderer.Render(id, onRenderFinish, options);
			}
		}

		function updateVisibility() {
			for (var id in categoryInfo.categoryStore) {
				// todo : dupe
				var isExcluded = categoryInfo.idExclusionList && categoryInfo.idExclusionList.indexOf(id) != -1;

				if (!isExcluded) {
					var categoryItem = categoryInfo.categoryStore[id];
					var caption = categoryInfo.getCaption(categoryItem);
					var includedInSearch = searchText === null || searchText.length <= 0 || caption.indexOf(searchText) != -1;
					var isVisible = includedInSearch && categoryInfo.includedInFilter(categoryItem, activeFilters);
					// todo : switch to use a style?
					document.getElementById(getThumbId(id)).style.display = isVisible ? "inline-block" : "none";
				}
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
				for (id in categoryInfo.categoryStore) {
					// todo : dupe
					var isExcluded = categoryInfo.idExclusionList && categoryInfo.idExclusionList.indexOf(id) != -1;

					if (!isExcluded) {
						renderThumbnail(id);
					}
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
				var categoryItem = categoryInfo.categoryStore[e.id];
				var caption = categoryInfo.getCaption(categoryItem);

				var nameText = document.getElementById(getThumbNameTextId(e.id));
				nameText.innerText = caption;

				if (categoryItem.name === undefined || categoryItem.name === null) {
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

		events.Listen("change_find_filter", function(e) {
			updateVisibility();
		});

		// init category
		refreshThumbs();
	}

	function CreateThumbnail(thumbId, thumbImgId, thumbNameTextId, categoryItem, caption, iconId, onClick, hasRenderer) {
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

		if (categoryItem.name === undefined || categoryItem.name === null) {
			nameText.classList.add("thumbnailDefaultName");
		}

		nameCaption.appendChild(nameText);

		div.appendChild(nameCaption);

		return div;
	}

	events.Raise("change_find_filter", { searchText: searchText, activeFilters: activeFilters });

	/* SELECT CONTROL */
	var isSelectMode = false;
	var onSelectFunc = null; // todo : names?
	var preSelectState = {
		searchText : "",
		activeFilters : [],
		prevId : null,
		filterVisible : false,
	};
	controls.selectRoot.style.display = "none";

	function StartSelectMode(message, prevId, filters, onSelect) {
		preSelectState.filterVisible = controls.filterVisibleCheck.checked;
		preSelectState.searchText = searchText;
		preSelectState.activeFilters = activeFilters;
		preSelectState.prevId = prevId;

		controls.selectRoot.style.display = "flex";
		controls.filterVisibleCheck.checked = false;
		controls.filterVisibleCheck.disabled = true; // todo : hide instead?
		controls.filterRoot.style.display = "none";

		events.Raise("change_find_filter", { searchText: "", activeFilters: filters });

		controls.selectMessage.innerText = message;

		onSelectFunc = onSelect;
		isSelectMode = true;
	}

	function FinishSelectMode(isConfirmed) {
		controls.selectRoot.style.display = "none";
		controls.filterVisibleCheck.checked = preSelectState.filterVisible;
		controls.filterVisibleCheck.disabled = false;
		controls.filterRoot.style.display = preSelectState.filterVisible ? "block" : "none";

		events.Raise("change_find_filter", { searchText: preSelectState.searchText, activeFilters: preSelectState.activeFilters });

		if (!isConfirmed && onSelectFunc) {
			onSelectFunc(preSelectState.prevId);
		}

		onSelectFunc = null;
		isSelectMode = false;
	}

	controls.selectCancelButton.onclick = function() { FinishSelectMode(false); };
	controls.selectConfirmButton.onclick = function() { FinishSelectMode(true); };

	this.CancelSelect = function() {
		if (isSelectMode) {
			FinishSelectMode(false);
		}
	}

	// todo : still not sure what the right combo of buttons and iteractions is..
	this.CreateSelectControl = function(categoryName, options) {
		var category = categories[categoryName];
		var filters = options && options.filters ? options.filters : [categoryName];
		var toolId = options && options.toolId ? options.toolId : null;
		var hasNoneOption = options && options.hasNoneOption;

		var span = document.createElement("span");
		span.classList.add("selectControl");

		if (category.thumbnailRenderer) {
			var thumb = document.createElement("img");
			span.appendChild(thumb);
		}

		var select = document.createElement("select");
		select.onchange = function() {
			updateSelection(select.value);
		};
		span.appendChild(select);

		var findButton = document.createElement("button");
		findButton.appendChild(iconUtils.CreateIcon("search"));
		findButton.onclick = function() {
			// todo : localize
			var message = options && options.getSelectMessage ? options.getSelectMessage() : "selecting...";
			StartSelectMode(message, select.value, filters, updateSelection);
			showPanel("findPanel", toolId);
		};
		span.appendChild(findButton);

		function tryOpenTool() {
			var selectedId = select.value;
			if (selectedId) {
				showPanel(category.toolId, toolId);
				events.Raise(category.selectEventId, { id: selectedId });
			}
		}

		var editButton = document.createElement("button");
		editButton.appendChild(iconUtils.CreateIcon("open_tool"));
		editButton.onclick = tryOpenTool;
		span.appendChild(editButton);

		function updateSelection(id) {
			if (id === "null") {
				id = null;
			}

			if (!(id in category.categoryStore) && id != null) {
				return; // it's not great if we have invalid IDs being selected
			}

			select.value = id;

			if (category.thumbnailRenderer && id != null) {
				var thumbCache = category.thumbnailRenderer.GetCacheEntry(id);

				if (!thumbCache.outOfDate) {
					thumb.src = thumbCache.uri;
				}
				else {
					// todo : what if you switch selection before the render is done?
					var onRenderFinish = function(uri) {
						thumb.src = uri;
					}

					var renderOptions = {};
					if (category.getRenderOptions) {
						renderOptions = category.getRenderOptions(category.categoryStore[id]);
					}

					category.thumbnailRenderer.Render(id, onRenderFinish, renderOptions);
				}
			}

			if (options && options.onSelectChange) {
				options.onSelectChange(id);
			}
		}

		function updateOptions() {
			var tempValue = select.value;
			select.innerHTML = "";

			if (hasNoneOption) {
				var option = document.createElement("option");
				option.value = null;
				option.innerText = "none"; // todo : localize!
				select.appendChild(option);
			}

			for (var id in category.categoryStore) {
				var categoryItem = category.categoryStore[id];

				// todo : stop duplicating this...
				var isExcluded = category.idExclusionList && category.idExclusionList.indexOf(id) != -1;

				if (!isExcluded && category.includedInFilter(categoryItem, filters)) {
					var option = document.createElement("option");
					option.value = id;
					option.innerText = category.getCaption(categoryItem);
					select.appendChild(option);
				}
			}

			if (tempValue) {
				updateSelection(tempValue);	
			}
		}

		updateOptions();

		return {
			GetElement : function() { return span; },
			UpdateOptions : updateOptions,
			SetSelection : updateSelection,
			OpenTool : tryOpenTool,
		};
	}
}

function ThumbnailRenderer(getRenderable, getHexPalette, onRender) {
	var drawingThumbnailCanvas, drawingThumbnailCtx;
	drawingThumbnailCanvas = document.createElement("canvas");
	drawingThumbnailCanvas.width = 8 * scale; // TODO: scale constants need to be contained somewhere
	drawingThumbnailCanvas.height = 8 * scale;
	drawingThumbnailCtx = drawingThumbnailCanvas.getContext("2d");

	var thumbnailRenderEncoders = {};
	var cache = {};

	function render(id, callback, options) {
		var renderable = getRenderable(id);
		var hexPalette = getHexPalette(renderable);
		var drawingFrameData = onRender(renderable, drawingThumbnailCtx, options);

		var cacheId = options && options.cacheId ? options.cacheId : id;

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
		if (thumbnailRenderEncoders[cacheId] != null) {
			thumbnailRenderEncoders[cacheId].cancel();
		}
		thumbnailRenderEncoders[cacheId] = encoder;

		// start encoding new GIF
		encoder.encode(gifData, function(uri) {
			// update cache
			cache[cacheId] = {
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
				outOfDate : true,
			};
		}

		return cache[id];
	}
} // ThumbnailRenderer()

function CreateDrawingThumbnailRenderer() {
	var getRenderable = function(id) {
		return tile[id];
	}

	var getHexPalette = function(til) {
		var palId = getRoomPal(curRoom);

		var hexPalette = [];
		var roomColors = getPal(palId);
		for (i in roomColors) {
			var hexStr = rgbToHex(roomColors[i][0], roomColors[i][1], roomColors[i][2]).slice(1);
			hexPalette.push(hexStr);
		}

		return hexPalette;
	}

	var onRender = function(til, ctx, options) {
		var palId = getRoomPal(curRoom);
		var drawingFrameData = [];

		for (var i = 0; i < til.animation.frameCount; i++) {
			if (options.isAnimated || options.frameIndex === i) {
				var renderedTile = renderer.GetRenderedTile(til, i);
				var hackTileTexture = textureCache[renderedTile].canvas; // todo : RENDER HACK
				ctx.drawImage(hackTileTexture, 0, 0, tilesize * scale, tilesize * scale);

				drawingFrameData.push(ctx.getImageData(0, 0, 8 * scale, 8 * scale).data);
			}
		}

		return drawingFrameData;
	}

	return new ThumbnailRenderer(getRenderable, getHexPalette, onRender);
}

function CreateRoomThumbnailRenderer() {
	var getRenderable = function(id) {
		return room[id];
	}

	var getHexPalette = function(r) {
		var palId = r.pal;

		var hexPalette = [];
		var roomColors = getPal(palId);
		for (i in roomColors) {
			var hexStr = rgbToHex(roomColors[i][0], roomColors[i][1], roomColors[i][2]).slice(1);
			hexPalette.push(hexStr);
		}

		return hexPalette;
	}

	var onRender = function(r, ctx, options) {
		mapTool.DrawMiniRoom(r.id, 0, 0, 8 * scale, ctx);
		return [ctx.getImageData(0, 0, 8 * scale, 8 * scale).data];
	}

	return new ThumbnailRenderer(getRenderable, getHexPalette, onRender);
}

function CreatePaletteThumbnailRenderer() {
	var getRenderable = function(id) {
		return palette[id];
	}

	var getHexPalette = function(pal) {
		var palId = pal.id;

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

	return new ThumbnailRenderer(getRenderable, getHexPalette, onRender);
}

function CreateMapThumbnailRenderer() {
	var getRenderable = function(id) {
		return map[id];
	}

	var hexColorMap;

	// todo : probably bad practice to generate the hex color map as a side effect but oh well
	var getHexPalette = function(m) {
		hexColorMap = {
			"0" : "#000000",
		};

		for (var y = 0; y < mapsize; y++) {
			for (var x = 0; x < mapsize; x++) {
				var roomId = m.map[y][x];
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

	var onRender = function(m, ctx, options) {
		ctx.fillStyle = hexColorMap["0"];
		ctx.fillRect(0, 0, 8 * scale, 8 * scale);

		for (var y = 0; y < mapsize; y++) {
			for (var x = 0; x < mapsize; x++) {
				var roomId = m.map[y][x];
				if (roomId != "0" && roomId in room) {
					var hexStr = hexColorMap[roomId];
					ctx.fillStyle = hexStr;
					ctx.fillRect(x * scale, y * scale, 1 * scale, 1 * scale);
				}
			}
		}

		return [ctx.getImageData(0, 0, 8 * scale, 8 * scale).data];
	}

	return new ThumbnailRenderer(getRenderable, getHexPalette, onRender);
}