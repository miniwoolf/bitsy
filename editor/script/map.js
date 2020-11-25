function MapTool(controls) {
	var canvasTileSize = 3; // one "pixel"
	var canvasRoomSize = canvasTileSize * roomsize;
	var canvasSize = canvasRoomSize * mapsize

	controls.canvas.style.width = canvasSize;
	controls.canvas.style.height = canvasSize;
	controls.canvas.width = canvasSize;
	controls.canvas.height = canvasSize;

	var context = controls.canvas.getContext("2d");

	var curMapId = null;

	var selectedCornerOffset = 1;

	var Mode = {
		Select : 0,
		Move : 1,
	};

	curMode = Mode.Select;
	controls.canvas.classList.add("selectCursorWhite");

	function DrawMap() {
		context.fillStyle = "black";
		context.fillRect(0, 0, canvasSize, canvasSize);

		// draw rooms
		if (curMapId in map) {
			for (var y = 0; y < mapsize; y++) {
				for (var x = 0; x < mapsize; x++) {
					var roomId = map[curMapId].map[y][x];
					if (roomId != "0" && roomId in room) {
						DrawRoom(roomId, x, y, canvasRoomSize, context);
					}
				}
			}
		}

		// draw grid
		context.fillStyle = "gray";

		for (var x = 1; x < mapsize; x++) {
			context.fillRect(x * canvasRoomSize, 0, 1, canvasSize);
		}

		for (var y = 1; y < mapsize; y++) {
			context.fillRect(0, y * canvasRoomSize, canvasSize, 1);
		}

		// draw selection
		var selectionId = isPlayMode ? curRoom : curRoomId; // todo : is the global ok?
		if (selectionId != null && room[selectionId].mapLocation.id === curMapId) {
			DrawSelection(room[selectionId].mapLocation.x, room[selectionId].mapLocation.y, selectedCornerOffset);
		}
	}

	// animate selection
	setInterval(function() {
		if (selectedCornerOffset == 1) {
			selectedCornerOffset = 2;
		}
		else {
			selectedCornerOffset = 1;
		}

		DrawMap();
	}, 400);

	function DrawRoom(roomId, x, y, size, ctx) {
		var palId = room[roomId].pal;
		var colors = (palId in palette) ? palette[palId].colors : color.GetDefaultPalette();

		function hexFromPal(i) {
			// todo : is this the best way to handle this?
			if (i < 0) {
				i = 0;
			}
			else if (i >= colors.length) {
				i = colors.length - 1;
			}

			return rgbToHex(colors[i][0], colors[i][1], colors[i][2])
		}

		ctx.fillStyle = hexFromPal(0);
		ctx.fillRect(x * size, y * size, size, size);

		for (var ry = 0; ry < roomsize; ry++) {
			for (var rx = 0; rx < roomsize; rx++) {
				var tileId = room[roomId].tilemap[ry][rx];

				if (tileId != NULL_ID && (tileId in tile)) {
					ctx.fillStyle = hexFromPal(parseInt(tile[tileId].col));
					DrawRoomTile(x, y, rx, ry, size, ctx);
				}

				for (var i = 0; i < room[roomId].tileOverlay.length; i++) {
					var location = room[roomId].tileOverlay[i];
					if (location.x === rx && location.y === ry) {
						tileId = location.id;
					}
				}
			}
		}
	}
	this.DrawMiniRoom = DrawRoom;

	function DrawRoomTile(x, y, rx, ry, size, ctx) {
		var tileSize = size / roomsize;

		var canvasRoomX = x * size;
		var canvasRoomY = y * size;

		ctx.fillRect(
			canvasRoomX + (rx * tileSize),
			canvasRoomY + (ry * tileSize),
			tileSize,
			tileSize);
	}

	function DrawSelection(x, y, cornerOffset) {
		context.fillStyle = "white";

		var min = -cornerOffset;
		var max = (roomsize - 1) + cornerOffset;

		// top left
		DrawRoomTile(x, y, min + 0, min + 0, canvasRoomSize, context);
		DrawRoomTile(x, y, min + 1, min + 0, canvasRoomSize, context);
		DrawRoomTile(x, y, min + 0, min + 1, canvasRoomSize, context);

		// top right
		DrawRoomTile(x, y, max + 0, min + 0, canvasRoomSize, context);
		DrawRoomTile(x, y, max - 1, min + 0, canvasRoomSize, context);
		DrawRoomTile(x, y, max + 0, min + 1, canvasRoomSize, context);

		// bottom left
		DrawRoomTile(x, y, min + 0, max + 0, canvasRoomSize, context);
		DrawRoomTile(x, y, min + 1, max + 0, canvasRoomSize, context);
		DrawRoomTile(x, y, min + 0, max - 1, canvasRoomSize, context);

		// bottom right
		DrawRoomTile(x, y, max + 0, max + 0, canvasRoomSize, context);
		DrawRoomTile(x, y, max - 1, max + 0, canvasRoomSize, context);
		DrawRoomTile(x, y, max + 0, max - 1, canvasRoomSize, context);
	}

	function OnMouseDown(e) {
		e.preventDefault();

		if (isPlayMode) {
			return; // can't edit during play mode
		}

		var off = getOffset(e);

		// todo : should "mobileOffsetCorrection" be renamed???
		off = mobileOffsetCorrection(off, e, mapsize);

		var x = Math.floor(off.x);
		var y = Math.floor(off.y);

		if (curMapId in map) {
			if (curMode === Mode.Move) {
				if (curRoomId != null && curRoomId != "0") {
					var prevRoomId = map[curMapId].map[y][x];
					if (prevRoomId != "0") {
						RemoveRoomFromMaps(prevRoomId);
					}

					if (prevRoomId != curRoomId) {
						RemoveRoomFromMaps(curRoomId);

						map[curMapId].map[y][x] = curRoomId;
						
						if (curRoomId in room) {
							room[curRoomId].mapLocation.id = curMapId;
							room[curRoomId].mapLocation.x = x;
							room[curRoomId].mapLocation.y = y;
						}
					}

					DrawMap();
					refreshGameData();

					events.Raise("change_map", { id: curMapId });
				}
			}
			else if (curMode === Mode.Select) {
				var roomId = map[curMapId].map[y][x];

				if (roomId != "0" && roomId in room) {
					events.Raise("select_room", { id: roomId });
				}
			}
		}
	}

	function RemoveRoomFromMaps(roomId) {
		for (id in map) {
			for (var y = 0; y < mapsize; y++) {
				for (var x = 0; x < mapsize; x++) {
					if (map[id].map[y][x] === roomId) {
						map[id].map[y][x] = "0";
					}
				}
			}
		}

		if (roomId in room) {
			room[roomId].mapLocation.id = null;
			room[roomId].mapLocation.x = -1;
			room[roomId].mapLocation.y = -1;
		}
	}

	function NextMap() {
		if (curMapId == null) {
			return;
		}

		// TODO : should I really switch to hex ids? does it even matter if maps are limited to 4?
		var idList = sortedIdList(map);
		var idIndex = idList.indexOf(curMapId);

		idIndex++;
		if (idIndex >= idList.length) {
			idIndex = 0;
		}

		events.Raise("select_map", { id: idList[idIndex] });
	}

	function PrevMap() {
		if (curMapId == null) {
			return;
		}

		var idList = sortedIdList(map);
		var idIndex = idList.indexOf(curMapId);

		idIndex--;
		if (idIndex < 0) {
			idIndex = idList.length - 1;
		}

		events.Raise("select_map", { id: idList[idIndex] });
	}

	function AddMap() {
		// todo : start at 0 or 1?
		var nextId = nextB256Id(map, 1, MAP_REGISTRY_SIZE);

		if (nextId != null) {
			map[nextId] = createMap(nextId);
			map[nextId].transition_effect_left = "SLL";
			map[nextId].transition_effect_right = "SLR";
			map[nextId].transition_effect_up = "SLU";
			map[nextId].transition_effect_down = "SLD";

			refreshGameData();

			events.Raise("add_map", { id: nextId });
			events.Raise("select_map", { id: nextId });
		}
		else {
			alert("oh no you ran out of maps! :(");
		}
	}

	function DeleteMap() {
		if (curMapId == null) {
			return;
		}

		// clear out map location for all rooms in map
		for (var y = 0; y < mapsize; y++) {
			for (var x = 0; x < mapsize; x++) {
				var roomId = map[curMapId].map[y][x];
				if (roomId != "0" && roomId in room) {
					room[roomId].mapLocation.id = null;
					room[roomId].mapLocation.x = -1;
					room[roomId].mapLocation.y = -1;
				}
			}
		}

		var idList = sortedIdList(map);
		var idIndex = idList.indexOf(curMapId);
		if (idIndex >= idList.length - 1) {
			idIndex = 0;
		}

		delete map[curMapId];

		refreshGameData();

		var nextId = null;
		idList = sortedIdList(map);
		if (idList.length > 0) {
			nextId = idList[idIndex];
		}

		events.Raise("delete_map", { id: curMapId });
		events.Raise("select_map", { id: nextId });
	}

	var curRoomId = null;

	events.Listen("select_room", function(e) {
		curRoomId = e.id;
		DrawMap();
	});

	events.Listen("select_map", function(e) {
		curMapId = e.id;

		if (sortedIdList(map).length > 0) {
			controls.editRoot.style.display = "block";
			controls.noMapMessage.style.display = "none";

			DrawMap();

			controls.nameInput.readOnly = false;
			controls.nameInput.value = map[curMapId].name;
			// todo : localize
			controls.nameInput.placeholder = "map " + curMapId + " " + makeCountLabel(curMapId, map, MAP_REGISTRY_SIZE);

			transitionEffectUpControl.SetSelection(map[curMapId].transition_effect_up);
			transitionEffectDownControl.SetSelection(map[curMapId].transition_effect_down);
			transitionEffectLeftControl.SetSelection(map[curMapId].transition_effect_left);
			transitionEffectRightControl.SetSelection(map[curMapId].transition_effect_right);
		}
		else {
			controls.nameInput.readOnly = true;
			controls.nameInput.value = null;
			controls.nameInput.placeholder = "";
			controls.editRoot.style.display = "none";
			controls.noMapMessage.style.display = "block";
		}
	});

	controls.canvas.addEventListener("mousedown", OnMouseDown);

	controls.nameInput.onchange = function() {
		if (curMapId && curMapId in map) {
			map[curMapId].name = controls.nameInput.value;
			refreshGameData();

			events.Raise("change_map_name", { id: curMapId, name: map[curMapId].name });
		}
	}

	controls.selectButton.checked = true;
	controls.selectButton.onclick = function() {
		curMode = Mode.Select;
		controls.canvas.classList.remove("placeCursorWhite");
		controls.canvas.classList.add("selectCursorWhite");
	};

	controls.moveButton.onclick = function() {
		curMode = Mode.Move;
		controls.canvas.classList.remove("selectCursorWhite");
		controls.canvas.classList.add("placeCursorWhite");
	};

	controls.prevButton.onclick = PrevMap;
	controls.nextButton.onclick = NextMap;
	controls.addButton.onclick = AddMap;
	controls.deleteButton.onclick = DeleteMap;

	var transitionEffectUpControl = new TransitionEffectControl(function(id) {
		if (curMapId && curMapId in map) {
			map[curMapId].transition_effect_up = id != "none" ? id : null;
			refreshGameData();
		}
	}, true);
	controls.transitionEffectUp.appendChild(transitionEffectUpControl.GetElement());

	var transitionEffectDownControl = new TransitionEffectControl(function(id) {
		if (curMapId && curMapId in map) {
			map[curMapId].transition_effect_down = id != "none" ? id : null;
			refreshGameData();
		}
	}, true);
	controls.transitionEffectDown.appendChild(transitionEffectDownControl.GetElement());

	var transitionEffectLeftControl = new TransitionEffectControl(function(id) {
		if (curMapId && curMapId in map) {
			map[curMapId].transition_effect_left = id != "none" ? id : null;
			refreshGameData();
		}
	}, true);
	controls.transitionEffectLeft.appendChild(transitionEffectLeftControl.GetElement());

	var transitionEffectRightControl = new TransitionEffectControl(function(id) {
		if (curMapId && curMapId in map) {
			map[curMapId].transition_effect_right = id != "none" ? id : null;
			refreshGameData();
		}
	}, true);
	controls.transitionEffectRight.appendChild(transitionEffectRightControl.GetElement());

	controls.showOptionsButton.onclick = function() {
		controls.optionsRoot.style.display = controls.showOptionsButton.checked ? "block" : "none";
	}
}

var TransitionEffects = [
	{
		GetName: function() { return localization.GetStringOrFallback("transition_fade_w", "fade (white)"); },
		id: TRANSITION_KEY.FADE_WHITE,
	},
	{
		GetName: function() { return localization.GetStringOrFallback("transition_fade_b", "fade (black)"); },
		id: TRANSITION_KEY.FADE_BLACK,
	},
	{
		GetName: function() { return localization.GetStringOrFallback("transition_wave", "wave"); },
		id: TRANSITION_KEY.WAVE,
	},
	{
		GetName: function() { return localization.GetStringOrFallback("transition_tunnel", "tunnel"); },
		id: TRANSITION_KEY.TUNNEL,
	},
	{
		GetName: function() { return localization.GetStringOrFallback("transition_slide_u", "slide up"); },
		id: TRANSITION_KEY.SLIDE_UP,
	},
	{
		GetName: function() { return localization.GetStringOrFallback("transition_slide_d", "slide down"); },
		id: TRANSITION_KEY.SLIDE_DOWN,
	},
	{
		GetName: function() { return localization.GetStringOrFallback("transition_slide_l", "slide left"); },
		id: TRANSITION_KEY.SLIDE_LEFT,
	},
	{
		GetName: function() { return localization.GetStringOrFallback("transition_slide_r", "slide right"); },
		id: TRANSITION_KEY.SLIDE_RIGHT,
	},
];

// todo : add custom select control?
function TransitionEffectControl(onChange, allowNone) {
	var input = document.createElement("select");
	input.title = "select transition effect";

	if (allowNone) {
		var noneOption = document.createElement("option");
		noneOption.value = "none";
		noneOption.innerText = "none"; // todo : localize
		input.appendChild(noneOption);
	}

	for (var i = 0; i < TransitionEffects.length; i++) {
		var id = TransitionEffects[i].id;
		var transitionOption = document.createElement("option");
		transitionOption.value = id;
		transitionOption.innerText = TransitionEffects[i].GetName();
		input.appendChild(transitionOption);
	}

	input.onchange = function(event) {
		onChange(event.target.value);
	}

	this.GetElement = function() {
		return input;
	};

	this.SetSelection = function(id) {
		if (id === null) {
			id = "none";
		}

		input.value = id;
	};

	this.GetName = function() {
		for (var i = 0; i < TransitionEffects.length; i++) {
			if (TransitionEffects[i].id === input.value) {
				return TransitionEffects[i].GetName();
			}
		}

		return "none";
	};
};