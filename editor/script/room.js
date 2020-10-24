/*
	ROOM
*/

/*
TODO:
drawingId -> drawingId.id
paintMode -> drawingId.type

what other methods do I need to move into this class? exit stuff??
- exits
- endings
- items
- etc.
*/
function RoomTool(canvas) {
	var self = this; // feels a bit hacky

	// todo : RENDER HACK
	var ctx = context; // hacky to grab the global context like this :(

	var drawingId = "A";
	events.Listen("select_drawing", function(event) {
		drawingId = event.id;
	});

	// edit flags
	var isDragAddingTiles = false;
	var isDragDeletingTiles = false;

	// render flags
	this.drawMapGrid = true;
	this.drawCollisionMap = false;

	function getDrawingType() {
		return getDrawingTypeFromId(drawingId);
	}

	function onMouseDown(e) {
		e.preventDefault();

		var off = getOffset(e);
		off = mobileOffsetCorrection(off, e, (tilesize * roomsize *scale));
		var x = Math.floor( off.x / (tilesize*scale) );
		var y = Math.floor( off.y / (tilesize*scale) );

		if( self.editDrawingAtCoordinateCallback != null && e.altKey ) {
			self.editDrawingAtCoordinateCallback(x,y); // "eye dropper"
			return;
		}

		if (onSelectBehavior != null) {
			onSelectBehavior.OnSelect(curRoom, x, y);
			return;
		}

		if (drawingId != null) {
			//add tiles/sprites to map
			if (getDrawingType() == TileType.Tile) {
				if (room[curRoom].tilemap[y][x] === "0") {
					room[curRoom].tilemap[y][x] = drawingId;
					isDragAddingTiles = true;
				}
				else {
					//delete (better way to do this?)
					//row = row.substr(0, x) + "0" + row.substr(x+1);
					room[curRoom].tilemap[y][x] = "0";
					isDragDeletingTiles = true;
				}
				//room[curRoom].tilemap[y] = row;
			}
			else if (getDrawingType() == TileType.Avatar) {
				// TODO : bug -- doesn't erase other sprites!!
				var isAvatarAlreadyHere = false;

				for (roomId in room) {
					var playerSpr = null;
					for (i in room[roomId].sprites) {
						var spr = room[roomId].sprites[i];
						if (spr.id === drawingId) {
							playerSpr = spr;
						}
					}

					if (playerSpr) {
						if (roomId === curRoom && x == playerSpr.x && y == playerSpr.y) {
							isAvatarAlreadyHere = true;
						}

						var index = room[roomId].sprites.indexOf(playerSpr);
						room[roomId].sprites.splice(index, 1);
					}
				}

				if (!isAvatarAlreadyHere) {
					room[curRoom].sprites.push(createSpriteLocation(drawingId, x, y));
				}
			}
			else {
				// TODO : is this the final behavior I want?

				var otherSpr = getSpriteLocation(curRoom, x, y);
				var isSprAlreadyHere = otherSpr != null && otherSpr.id === drawingId;

				if (otherSpr) {
					var index = room[curRoom].sprites.indexOf(otherSpr);
					room[curRoom].sprites.splice(index, 1);
				}

				if (!isSprAlreadyHere) {
					room[curRoom].sprites.push(createSpriteLocation(drawingId, x, y));
				}
			}

			refreshGameData();
			self.drawEditMap();
		}

		events.Raise("change_room", { id: curRoom });
	}

	function onMouseMove(e) {
		if (onSelectBehavior != null) {
			return;
		}

		editTilesOnDrag(e);
	}

	function onMouseUp(e) {
		if (onSelectBehavior != null) {
			return;
		}

		editTilesOnDrag(e);
		isDragAddingTiles = false;
		isDragDeletingTiles = false;
	}

	function editTilesOnDrag(e) {
		var off = getOffset(e);
		off = mobileOffsetCorrection(off, e, (tilesize * roomsize * scale));
		var x = clamp(Math.floor(off.x / (tilesize*scale)), 0, roomsize - 1);
		var y = clamp(Math.floor(off.y / (tilesize*scale)), 0, roomsize - 1);
		// var row = room[curRoom].tilemap[y];
		if (isDragAddingTiles) {
			if ( room[curRoom].tilemap[y][x] != drawingId ) {
				room[curRoom].tilemap[y][x] = drawingId;
				refreshGameData();
				self.drawEditMap();
			}
		}
		else if (isDragDeletingTiles) {
			if (room[curRoom].tilemap[y][x] != "0") {
				// row = row.substr(0, x) + "0" + row.substr(x+1);
				// room[curRoom].tilemap[y] = row;
				room[curRoom].tilemap[y][x] = "0";
				refreshGameData();
				self.drawEditMap();
			}
		}

		events.Raise("change_room", { id: curRoom });
	}

	function onTouchStart(e) {
		e.preventDefault();
		// console.log(e.touches[0]);
		var fakeEvent = { target:e.target, clientX:e.touches[0].clientX, clientY:e.touches[0].clientY };
		// console.log(fakeEvent);
		onMouseDown( fakeEvent );
	}

	function onTouchMove(e) {
		e.preventDefault();
		var fakeEvent = { target:e.target, clientX:e.touches[0].clientX, clientY:e.touches[0].clientY };
		onMouseMove( fakeEvent );
	}

	function onTouchEnd(e) {
		e.preventDefault();
		// var fakeEvent = { target:e.target, clientX:e.touches[0].clientX, clientY:e.touches[0].clientY };
		// map_onMouseUp( fakeEvent );
		isDragAddingTiles = false;
		isDragDeletingTiles = false;
	}

	this.editDrawingAtCoordinateCallback = null;

	var mapEditAnimationLoop;

	this.listenEditEvents = function() {
		canvas.addEventListener("mousedown", onMouseDown);
		canvas.addEventListener("mousemove", onMouseMove);
		canvas.addEventListener("mouseup", onMouseUp);
		canvas.addEventListener("mouseleave", onMouseUp);
		canvas.addEventListener("touchstart", onTouchStart);
		canvas.addEventListener("touchmove", onTouchMove);
		canvas.addEventListener("touchend", onTouchEnd);

		// todo : is this causing an animation speed up?
		mapEditAnimationLoop = setInterval(function() {
			renderOnlyUpdate({ drawInstances: false, });
			self.drawEditMap();
		});
	}

	this.unlistenEditEvents = function() {
		canvas.removeEventListener("mousedown", onMouseDown);
		canvas.removeEventListener("mousemove", onMouseMove);
		canvas.removeEventListener("mouseup", onMouseUp);
		canvas.removeEventListener("mouseleave", onMouseUp);
		canvas.removeEventListener("touchstart", onTouchStart);
		canvas.removeEventListener("touchmove", onTouchMove);
		canvas.removeEventListener("touchend", onTouchEnd);

		clearInterval(mapEditAnimationLoop);
	}

	this.drawEditMap = function() {
		//draw grid
		if (self.drawMapGrid) {
			ctx.fillStyle = getContrastingColor();
			for (var x = 1; x < roomsize; x++) {
				ctx.fillRect(x * tilesize * scale, 0 * tilesize * scale, 1, roomsize * tilesize * scale);
			}
			for (var y = 1; y < roomsize; y++) {
				ctx.fillRect(0 * tilesize * scale, y * tilesize * scale, roomsize * tilesize * scale, 1);
			}
		}

		//draw walls
		if (self.drawCollisionMap) {
			ctx.fillStyle = getContrastingColor();
			for (y in room[curRoom].tilemap) {
				for (x in room[curRoom].tilemap[y]) {
					if (isWall(x, y, curRoom)) {
						ctx.fillRect(x * tilesize * scale, y * tilesize * scale, tilesize * scale, tilesize * scale);
					}
				}
			}
		}

		// TODO : new version of this!
		//draw exits (and entrances) and endings
	}

	events.Listen("palette_change", function(event) {
		self.drawEditMap();

		if (event.id === room[curRoom].pal) {
			events.Raise("change_room_palette", { id: curRoom, palId: event.id });
		}
	});

	var paletteSelect;
	function updateRoomPaletteSelect() {
		if (!paletteSelect && findTool) {
			paletteSelect = findTool.CreateSelectControl(
				"palette",
				{
					onSelectChange : function(id) {
						room[curRoom].pal = id;
						refreshGameData();

						// refresh the room palette & rerender everything
						initRoom(curRoom);

						// todo : can these listen to the even instead?
						roomTool.drawEditMap();
						paintTool.UpdateCanvas();

						events.Raise("change_room_palette", { id: curRoom, palId: id });
					},
					toolId : "roomPanel",
					getSelectMessage : function() {
						// todo : localize
						// todo : get actual room name
						return "select colors for " + findTool.GetDisplayName("room", curRoom) + "...";
					},
				});

			// todo : pass in control root via constructor
			document.getElementById("roomPaletteSelect").appendChild(paletteSelect.GetElement());
		}

		if (paletteSelect) {
			paletteSelect.SetSelection(room[curRoom].pal);
		}
	}

	this.Update = function() {
		self.drawEditMap();
		updateRoomPaletteSelect();
	}

	var onSelectBehavior = null;
	this.OnSelectLocation = function(onSelect, onFinish) {
		if (onSelectBehavior != null) {
			onSelectBehavior.OnFinish();
		}

		onSelectBehavior = {
			OnSelect : onSelect,
			OnFinish : function() {
				onFinish();
				onSelectBehavior = null;
			}
		};

		return onSelectBehavior;
	}
} // RoomTool()

/* 
	GLOBAL FUNCTIONS
	TODO : move as much as possible into the tool object
*/

/* PLAYMODE TODO 
- make a PlayModeController objec?
- share:
	- on_play_mode
	- on_edit_mode
*/
function togglePlayMode(e) {
	if (e.target.checked) {
		on_play_mode();
	}
	else {
		on_edit_mode();
	}

	updatePlayModeButton();
}

function on_room_name_change() {
	var str = document.getElementById("roomName").value;
	if(str.length > 0) {
		room[curRoom].name = str;
	}
	else {
		room[curRoom].name = null;
	}

	updateNamesFromCurData()

	refreshGameData();

	events.Raise("change_room_name", { id: curRoom, name: room[curRoom].name });
}

// todo: should this global function be replaced with a global event? (ok really what's the difference tho?)
function listenForRoomSelect() {
	events.Listen("select_room", function(e) {
		selectRoom(e.id);
	});
}

// todo : definitely move inside of tooL!
// I don't like that this only functions correctly if listenForSelectRoom is run before all other events...
// I need to add an "after_select_room" event...
function selectRoom(roomId) {
	// ok watch out this is gonna be hacky
	var ids = sortedRoomIdList();

	var nextRoomIndex = -1;
	for (var i = 0; i < ids.length; i++) {
		if (ids[i] === roomId) {
			nextRoomIndex = i;
		}
	}

	if (nextRoomIndex != -1) {
		roomIndex = nextRoomIndex;
		curRoom = ids[roomIndex];
		initRoom(curRoom);

		roomTool.Update(); // todo : input id?
		updateRoomName(); // todo : move inside of tool?
	}
}

// todo : put controls inside room tool and hook this up there!
// todo : move inside of tool?
function nextRoom() {
	var ids = sortedRoomIdList();
	var nextIndex = (roomIndex + 1) % ids.length;
	var nextId = ids[nextIndex];

	events.Raise("select_room", { id: nextId });
}

function prevRoom() {
	var ids = sortedRoomIdList();
	var prevIndex = roomIndex - 1;
	if (prevIndex < 0) {
		prevIndex = (ids.length - 1);
	}
	var prevId = ids[prevIndex];

	events.Raise("select_room", { id: prevId });
}

function duplicateRoom() {
	var idList = sortedRoomIdList();
	var copyRoomId = idList[roomIndex];
	var roomToCopy = room[copyRoomId];

	roomIndex = idList.length;
	var newRoomId = nextRoomId();

	var duplicateTilemap = [];
	for (y in roomToCopy.tilemap) {
		duplicateTilemap.push([]);
		for (x in roomToCopy.tilemap[y]) {
			duplicateTilemap[y].push( roomToCopy.tilemap[y][x] );
		}
	}

	room[newRoomId] = createRoom(newRoomId, roomToCopy.pal);
	room[newRoomId].tilemap = duplicateTilemap;
	room[newRoomId].sprites = roomToCopy.sprites.slice(0);

	refreshGameData();

	events.Raise("add_room", { id: newRoomId });
	events.Raise("select_room", { id: newRoomId });
}

function newRoom() {
	roomIndex = Object.keys( room ).length;
	var roomId = nextRoomId();

	var palIdList = sortedPaletteIdList();
	var palId = palIdList.length > 0 ? palIdList[0] : null;

	room[roomId] = createRoom(roomId, palId);
	refreshGameData();

	events.Raise("add_room", { id: roomId });
	events.Raise("select_room", { id: roomId });
}

function deleteRoom() {
	if ( Object.keys(room).length <= 1 ) {
		alert("You can't delete your only room!");
	}
	else if ( confirm("Are you sure you want to delete this room? You can't get it back.") ) {
		var roomId = sortedRoomIdList()[roomIndex];

		// delete exits in _other_ rooms that go to this room
		// todo : re-implement?

		delete room[roomId];

		refreshGameData();

		events.Raise("delete_room", { id: roomId });

		nextRoom();
		roomTool.drawEditMap();
		paintTool.UpdateCanvas();
	}
}

function toggleMapGrid(e) {
	roomTool.drawMapGrid = e.target.checked;
	iconUtils.LoadIcon(document.getElementById("roomGridIcon"), roomTool.drawMapGrid ? "visibility" : "visibility_off");
	roomTool.drawEditMap();
}

function toggleCollisionMap(e) {
	roomTool.drawCollisionMap = e.target.checked;
	iconUtils.LoadIcon(document.getElementById("roomWallsIcon"), roomTool.drawCollisionMap ? "visibility" : "visibility_off");
	roomTool.drawEditMap();
}