function MapTool(controls) {
	var canvasTileSize = 3; // one "pixel"
	var canvasRoomSize = canvasTileSize * roomsize;
	var canvasSize = canvasRoomSize * mapsize

	controls.canvas.style.width = canvasSize;
	controls.canvas.style.height = canvasSize;
	controls.canvas.width = canvasSize;
	controls.canvas.height = canvasSize;

	controls.canvas.addEventListener("mousedown", OnMouseDown);
	// TODO : are these necessary?
	// controls.canvas.addEventListener("mousemove", OnMouseMove);
	// controls.canvas.addEventListener("mouseup", OnMouseUp);
	// controls.canvas.addEventListener("mouseleave", OnMouseUp);

	// TODO : touch controls
	// controls.canvas.addEventListener("touchstart", onTouchStart);
	// controls.canvas.addEventListener("touchmove", onTouchMove);
	// controls.canvas.addEventListener("touchend", onTouchEnd);

	var context = controls.canvas.getContext("2d");

	var curMapId = "0"; // todo : start as null?

	var selectedCornerOffset = 1;

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
		if (curRoomId != null && room[curRoomId].mapLocation.id === curMapId) {
			DrawSelection(room[curRoomId].mapLocation.x, room[curRoomId].mapLocation.y, selectedCornerOffset);
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
				var tileId = room[roomId].tilemap[y][x];

				for (var i = 0; i < room[roomId].objects.length; i++) {
					var sprite = room[roomId].objects[i];
					if (sprite.x === rx && sprite.y === ry) {
						tileId = sprite.id;
					}
				}

				if (tileId != "0" && tileId in object) {
					context.fillStyle = hexFromPal(parseInt(object[sprite.id].col));
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

	DrawMap();

	this.Draw = DrawMap; // todo : hack

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
			var roomId = map[curMapId].map[y][x];

			if (roomId != "0" && roomId in room) {
				events.Raise("select_room", { roomId: roomId });
			}
		}
	}

	var curRoomId = null;

	events.Listen("select_room", function(e) {
		curRoomId = e.roomId;
		DrawMap();
	});
}