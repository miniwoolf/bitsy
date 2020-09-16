function MapTool(controls) {
	var canvasSize = 256;
	var canvasRoomSize = canvasSize / mapsize;
	var canvasTileSize = canvasRoomSize / roomsize;

	controls.canvas.style.width = canvasSize;
	controls.canvas.style.height = canvasSize;
	controls.canvas.width = canvasSize;
	controls.canvas.height = canvasSize;

	var context = controls.canvas.getContext("2d");

	var curMapId = "0"; // todo : start as null?

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
		context.fillStyle = "white";

		for (var x = 1; x < mapsize; x++) {
			context.fillRect(x * canvasRoomSize, 0, 1, canvasSize);
		}

		for (var y = 1; y < mapsize; y++) {
			context.fillRect(0, y * canvasRoomSize, canvasSize, 1);
		}
	}

	function DrawRoom(roomId, x, y) {
		var palId = room[roomId].pal;
		var colors = palette[palId].colors;

		function hexFromPal(i) {
			return rgbToHex(colors[i][0], colors[i][1], colors[i][2])
		}

		var canvasRoomX = x * canvasRoomSize;
		var canvasRoomY = y * canvasRoomSize;

		context.fillStyle = hexFromPal(0);
		context.fillRect(canvasRoomX, canvasRoomY, canvasRoomSize, canvasRoomSize);

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
					context.fillRect(canvasRoomX + (rx * canvasTileSize), canvasRoomY + (ry * canvasTileSize), canvasTileSize, canvasTileSize);
				}
			}
		}
	}

	DrawMap();

	this.Draw = DrawMap; // todo : hack
}