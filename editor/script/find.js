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
	var tileThumbnailRenderer = new ThumbnailRenderer();

	// todo : how do I want to structure this?
	AddCategory({
		name: "map",
		engineObjectStore: map,
		getCaption: function(obj) { return obj.name ? obj.name : "map " + obj.id; }, // TODO : localize
		getIconId: function(obj) { return "room"; }, // TODO : real icon
		createOnClick: function(id) {
			return function() {
				events.Raise("select_map", { mapId: id });
			};
		},
	});

	AddCategory({
		name: "room",
		engineObjectStore: room,
		getCaption: function(obj) { return obj.name ? obj.name : "room " + obj.id; }, // TODO : localize
		getIconId: function(obj) { return "room"; },
		createOnClick: function(id) {
			return function() {
				events.Raise("select_room", { roomId: id });
			};
		},
	});

	AddCategory({
		name: "drawing",
		engineObjectStore: object,
		// todo : store in category object?
		getCaption: function(obj) {
			var caption = "";

			if (obj.name) {
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
				else if (obj.tpe === "ITM") {
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
		createOnClick: function(id) {
			return function() {
				events.Raise("select_drawing", { id: id });
			};
		},
		onRender: function(id, thumbRoot, thumbImg) {
			var onRenderFinish = function(uri) {
				thumbImg.src = uri;
				thumbRoot.classList.add("findToolThumbnailRendered");
			}

			tileThumbnailRenderer.Render(thumbImg.id, id, null, thumbImg, onRenderFinish);
		},
	});

	AddCategory({
		name: "dialog",
		engineObjectStore: dialog,
		getCaption: function(obj) { return obj.name ? obj.name : "dialog " + obj.id; }, // TODO : localize
		getIconId: function(obj) { return "dialog"; },
		createOnClick: function(id) {
			return function() {
				// todo : replace this global function with an event
				openDialogTool(id);
			};
		},
	});

	AddCategory({
		name: "palette",
		engineObjectStore: palette,
		getCaption: function(obj) { return obj.name ? obj.name : "palette " + obj.id; }, // TODO : localize
		getIconId: function(obj) { return "colors"; },
		createOnClick: function(id) {
			return function() {
				events.Raise("select_palette", { id: id });
			};
		},
	});

	function AddCategory(categoryInfo) {
		for (id in categoryInfo.engineObjectStore) {
			var engineObject = categoryInfo.engineObjectStore[id];
			AddThumbnail(
				"find_" + categoryInfo.name + "_" + engineObject.id,
				engineObject,
				categoryInfo.getCaption(engineObject),
				categoryInfo.getIconId(engineObject),
				categoryInfo.createOnClick(id),
				categoryInfo.onRender);
		}
	}

	function AddThumbnail(thumbId, engineObject, caption, iconId, onClick, onRender) {
		var div = document.createElement("div");
		// div.style.width = "100px";
		// div.style.display = "inline-block";

		// var img = document.createElement("img");
		var thumbnail = document.createElement("div");
		thumbnail.classList.add("findToolThumbnail");
		thumbnail.appendChild(iconUtils.CreateIcon(iconId));
		thumbnail.onclick = onClick;

		if (onRender) {
			var img = document.createElement("img");
			thumbnail.appendChild(img);
			img.id = thumbId + "_img";
			onRender(engineObject.id, thumbnail, img);
		}

		div.appendChild(thumbnail);

		var displayCaptions = true; // todo : why is this optional?
		if (displayCaptions) {
			var nameCaption = document.createElement("figcaption");
			// nameCaption.id = idPrefix + "Caption_" + id;

			nameCaption.innerText = caption; // img.title; // todo

			if (engineObject.name === undefined || engineObject.name === null) {
				nameCaption.classList.add("thumbnailDefaultName");
			}

			div.appendChild(nameCaption);
		}

		controls.contentRoot.appendChild(div);

		// updateThumbnail( id ); // todo ?
	}
}