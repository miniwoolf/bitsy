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

	curMode = Mode.Move;

	function DrawMap() {
		context.fillStyle = "black";
		context.fillRect(0, 0, canvasSize, canvasSize);

		// draw rooms
		if (curMapId in map) {
			for (var y = 0; y < mapsize; y++) {
				for (var x = 0; x < mapsize; x++) {
					var roomId = map[curMapId].map[y][x];
					if (roomId != "0" && roomId in room) {
						DrawRoom(roomId, x, y);
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

	function DrawRoom(roomId, x, y) {
		var palId = room[roomId].pal;
		var colors = palette[palId].colors;

		function hexFromPal(i) {
			return rgbToHex(colors[i][0], colors[i][1], colors[i][2])
		}

		context.fillStyle = hexFromPal(0);
		context.fillRect(x * canvasRoomSize, y * canvasRoomSize, canvasRoomSize, canvasRoomSize);

		for (var ry = 0; ry < roomsize; ry++) {
			for (var rx = 0; rx < roomsize; rx++) {
				var tileId = room[roomId].tilemap[ry][rx];

				for (var i = 0; i < room[roomId].objects.length; i++) {
					var sprite = room[roomId].objects[i];
					if (sprite.x === rx && sprite.y === ry) {
						tileId = sprite.id;
					}
				}

				if (tileId != "0" && tileId in object) {
					context.fillStyle = hexFromPal(parseInt(object[tileId].col));
					DrawRoomTile(x, y, rx, ry);
				}
			}
		}
	}

	function DrawRoomTile(x, y, rx, ry) {
		var canvasRoomX = x * canvasRoomSize;
		var canvasRoomY = y * canvasRoomSize;

		context.fillRect(
			canvasRoomX + (rx * canvasTileSize),
			canvasRoomY + (ry * canvasTileSize),
			canvasTileSize,
			canvasTileSize);
	}

	function DrawSelection(x, y, cornerOffset) {
		context.fillStyle = "white";

		var min = -cornerOffset;
		var max = (roomsize - 1) + cornerOffset;

		// top left
		DrawRoomTile(x, y, min + 0, min + 0);
		DrawRoomTile(x, y, min + 1, min + 0);
		DrawRoomTile(x, y, min + 0, min + 1);

		// top right
		DrawRoomTile(x, y, max + 0, min + 0);
		DrawRoomTile(x, y, max - 1, min + 0);
		DrawRoomTile(x, y, max + 0, min + 1);

		// bottom left
		DrawRoomTile(x, y, min + 0, max + 0);
		DrawRoomTile(x, y, min + 1, max + 0);
		DrawRoomTile(x, y, min + 0, max - 1);

		// bottom right
		DrawRoomTile(x, y, max + 0, max + 0);
		DrawRoomTile(x, y, max - 1, max + 0);
		DrawRoomTile(x, y, max + 0, max - 1);
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
				}
			}
			else if (curMode === Mode.Select) {
				var roomId = map[curMapId].map[y][x];

				if (roomId != "0" && roomId in room) {
					events.Raise("select_room", { roomId: roomId });
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
		// TODO : should I really switch to hex ids? does it even matter if maps are limited to 4?
		var idList = sortedHexIdList(map);
		var idIndex = idList.indexOf(curMapId);

		idIndex++;
		if (idIndex >= idList.length) {
			idIndex = 0;
		}

		events.Raise("select_map", { mapId: idList[idIndex] });
	}

	function PrevMap() {
		var idList = sortedHexIdList(map);
		var idIndex = idList.indexOf(curMapId);

		idIndex--;
		if (idIndex < 0) {
			idIndex = idList.length - 1;
		}

		events.Raise("select_map", { mapId: idList[idIndex] });
	}

	function AddMap() {
		var nextId = nextObjectHexId(sortedHexIdList(map));
		map[nextId] = createMap(nextId);
		refreshGameData();

		events.Raise("select_map", { mapId: nextId });
	}

	function DeleteMap() {
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

		var idList = sortedHexIdList(map);
		var idIndex = idList.indexOf(curMapId);
		if (idIndex >= idList.length - 1) {
			idIndex = 0;
		}

		delete map[curMapId];

		refreshGameData();

		idList = sortedHexIdList(map);

		events.Raise("select_map", { mapId: idList[idIndex] });
	}

	var curRoomId = null;

	events.Listen("select_room", function(e) {
		curRoomId = e.roomId;
		DrawMap();
	});

	events.Listen("select_map", function(e) {
		curMapId = e.mapId;

		DrawMap();

		controls.nameInput.value = map[curMapId].name;
		controls.nameInput.placeholder = "map " + curMapId; // todo : LOCALIZE
	});

	controls.canvas.addEventListener("mousedown", OnMouseDown);
	controls.nameInput.onchange = function() {
		if (curMapId && curMapId in map) {
			map[curMapId].name = controls.nameInput.value;
			refreshGameData();
		}
	}
	controls.selectButton.onclick = function() { curMode = Mode.Select; };
	controls.moveButton.onclick = function() { curMode = Mode.Move; };
	controls.prevButton.onclick = PrevMap;
	controls.nextButton.onclick = NextMap;
	controls.addButton.onclick = AddMap;
	controls.deleteButton.onclick = DeleteMap;
}