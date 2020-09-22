function FindTool(controls) {
	// todo : how do I want to structure this?
	AddCategory({
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
		getIconId: function(obj) { return "tile"; }, // todo : specialize by type
		createOnClick: function(id) {
			return function() {
				events.Raise("select_drawing", { id: id });
			};
		},
	});

	AddCategory({
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
				engineObject,
				categoryInfo.getCaption(engineObject),
				categoryInfo.getIconId(engineObject),
				categoryInfo.createOnClick(id));
		}
	}

	function AddThumbnail(engineObject, caption, iconId, onClick) {
		var div = document.createElement("div");
		// div.style.width = "100px";
		// div.style.display = "inline-block";

		// var img = document.createElement("img");
		var img = document.createElement("div");
		img.classList.add("findToolThumbnail");
		img.appendChild(iconUtils.CreateIcon(iconId));
		img.onclick = onClick;
		// img.id = getThumbnailId(id); // todo

		// todo : need per category way of getting name
		// if( drawingCategory === TileType.Tile ) {
		// 	img.title = tile[id].name ? tile[id].name : localization.GetStringOrFallback("tile_label", "tile") + " " + id;
		// }
		// else if( drawingCategory === TileType.Sprite ) {
		// 	img.title = sprite[id].name ? sprite[id].name : localization.GetStringOrFallback("sprite_label", "sprite") + " " + id;
		// }
		// else if( drawingCategory === TileType.Avatar ) {
		// 	img.title = localization.GetStringOrFallback("avatar_label", "avatar");
		// }
		// else if( drawingCategory === TileType.Item ) {
		// 	img.title = item[id].name ? item[id].name : localization.GetStringOrFallback("item_label", "item") + " " + id;
		// }

		div.appendChild(img);

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