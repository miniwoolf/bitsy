/*
TODO
- respond to events: add/delete stuff, edit stuff, new game data, active palette changed, selection changed
- animated thumbnails broken?
- thumbnails for non-drawing stuff (rooms, maps, etc)
- search
- category select
- test out performance for large games
- hide default palette
- selection for each category
*/

function FindTool(controls) {
	// todo : how do I want to structure this?
	AddCategory({
		name: "map",
		engineObjectStore: map,
		getCaption: function(obj) { return obj.name ? obj.name : "map " + obj.id; }, // TODO : localize
		getIconId: function(obj) { return "room"; }, // TODO : real icon
		selectEventId: "select_map",
		toolId: "mapPanel",
		addEventId: "add_map",
		deleteEventId: "delete_map",
		changeNameEventId: "change_map_name",
	});

	AddCategory({
		name: "room",
		engineObjectStore: room,
		getCaption: function(obj) { return obj.name ? obj.name : "room " + obj.id; }, // TODO : localize
		getIconId: function(obj) { return "room"; },
		selectEventId: "select_room",
		toolId: "roomPanel",
		addEventId: "add_room",
		deleteEventId: "delete_room",
		changeNameEventId: "change_room_name",
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
		name: "dialog",
		engineObjectStore: dialog,
		getCaption: function(obj) { return obj.name ? obj.name : "dialog " + obj.id; }, // TODO : localize
		getIconId: function(obj) { return "dialog"; },
		selectEventId: "select_dialog",
		toolId: "dialogPanel",
		// TODO : add & delete
		changeNameEventId: "change_dialog_name",
	});

	AddCategory({
		name: "palette",
		engineObjectStore: palette,
		getCaption: function(obj) { return obj.name ? obj.name : "palette " + obj.id; }, // TODO : localize
		getIconId: function(obj) { return "colors"; },
		selectEventId: "select_palette",
		toolId: "colorsPanel",
		addEventId: "add_palette",
		deleteEventId: "delete_palette",
		changeNameEventId: "change_palette_name",
	});

	function AddCategory(categoryInfo) {
		var categoryDiv = document.createElement("div");
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

			var nameCaption = document.createElement("figcaption");

			nameCaption.appendChild(iconUtils.CreateIcon(iconId));

		var nameText = document.createElement("span");
		nameText.id = thumbNameTextId;
		nameText.innerText = caption; // img.title; // todo
		if (engineObject.name === undefined || engineObject.name === null) {
			nameText.classList.add("thumbnailDefaultName");
		}
		nameCaption.appendChild(nameText);

		div.appendChild(nameCaption);

		return div;
	}
}