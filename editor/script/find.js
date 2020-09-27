/*
TODO
- respond to events: add/delete stuff, edit stuff, new game data, active palette changed, selection changed
- animated thumbnails broken?
- thumbnails for non-drawing stuff (rooms, maps, etc)
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
	events.Listen("select_room", function() {
		if (activeFilters.indexOf("cur_room") != -1) {
			events.Raise("change_find_filter", { searchText: searchText, activeFilters: activeFilters });
		}
	});

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
		refreshThumbEventId: "change_drawing",
		refreshAllThumbsEventIdList: ["change_room_palette", "select_room"],
		changeNameEventId: "change_drawing_name",
		thumbnailRenderer: new ThumbnailRenderer(),
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

				categoryInfo.thumbnailRenderer.Render(thumbImg.id, id, null, thumbImg, onRenderFinish);
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

		if (categoryInfo.refreshThumbEventId) {
			events.Listen(categoryInfo.refreshThumbEventId, function(e) {
				renderThumbnail(e.id);
			});
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