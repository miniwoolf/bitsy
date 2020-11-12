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
function RoomTool(controls) {
	var self = this; // feels a bit hacky

	// todo : RENDER HACK
	var ctx = context; // hacky to grab the global context like this :(

	var EditTool = {
		Paint : 0,
		Erase : 1,
		Select : 2,
	};

	var curEditTool = EditTool.Paint;

	var drawingId = "A";
	events.Listen("select_drawing", function(event) {
		drawingId = event.id;
	});

	// edit flags
	var isDragAddingTiles = false;
	var isDragDeletingTiles = false;

	// render flags
	var drawMapGrid = true;
	var drawCollisionMap = false;

	function onMouseDown(e) {
		e.preventDefault();

		var off = getOffset(e);
		off = mobileOffsetCorrection(off, e, (tilesize * roomsize *scale));
		var x = Math.floor( off.x / (tilesize*scale) );
		var y = Math.floor( off.y / (tilesize*scale) );

		if (onSelectBehavior != null) {
			onSelectBehavior.OnSelect(curRoom, x, y);
			return;
		}
		else if (curEditTool === EditTool.Paint) {
			if (drawingId != null) {
				if (tile[drawingId].type === TYPE_KEY.TILE) {
					room[curRoom].tilemap[y][x] = drawingId;
					isDragAddingTiles = true;
				}
				else {
					removeAllSpritesAtLocation(curRoom, x, y);

					// only one instance of the avatar allowed
					if (tile[drawingId].type === TYPE_KEY.AVATAR) {
						removeAllSprites(drawingId);
					}

					room[curRoom].sprites.push(createSpriteLocation(drawingId, x, y));
				}

				refreshGameData();
				self.drawEditMap();
			}
		}
		else if (curEditTool === EditTool.Erase) {
			// todo
		}
		else if (curEditTool === EditTool.Select) {
			// todo
		}

		events.Raise("change_room", { id: curRoom });
	}

	function onMouseMove(e) {
		if (onSelectBehavior != null) {
			return;
		}

		onDragEdit(e);
	}

	function onMouseUp(e) {
		if (onSelectBehavior != null) {
			return;
		}

		onDragEdit(e);

		isDragAddingTiles = false;
		isDragDeletingTiles = false;
	}

	function onDragEdit(e) {
		var off = getOffset(e);
		off = mobileOffsetCorrection(off, e, (tilesize * roomsize * scale));
		var x = clamp(Math.floor(off.x / (tilesize*scale)), 0, roomsize - 1);
		var y = clamp(Math.floor(off.y / (tilesize*scale)), 0, roomsize - 1);

		if (curEditTool === EditTool.Paint && isDragAddingTiles) {
			room[curRoom].tilemap[y][x] = drawingId;
			refreshGameData();
			self.drawEditMap();
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

	var mapEditAnimationLoop;

	this.listenEditEvents = function() {
		controls.canvas.addEventListener("mousedown", onMouseDown);
		controls.canvas.addEventListener("mousemove", onMouseMove);
		controls.canvas.addEventListener("mouseup", onMouseUp);
		controls.canvas.addEventListener("mouseleave", onMouseUp);
		controls.canvas.addEventListener("touchstart", onTouchStart);
		controls.canvas.addEventListener("touchmove", onTouchMove);
		controls.canvas.addEventListener("touchend", onTouchEnd);

		// todo : is this causing an animation speed up?
		mapEditAnimationLoop = setInterval(function() {
			renderOnlyUpdate({ drawInstances: false, });
			self.drawEditMap();
		});
	}

	this.unlistenEditEvents = function() {
		controls.canvas.removeEventListener("mousedown", onMouseDown);
		controls.canvas.removeEventListener("mousemove", onMouseMove);
		controls.canvas.removeEventListener("mouseup", onMouseUp);
		controls.canvas.removeEventListener("mouseleave", onMouseUp);
		controls.canvas.removeEventListener("touchstart", onTouchStart);
		controls.canvas.removeEventListener("touchmove", onTouchMove);
		controls.canvas.removeEventListener("touchend", onTouchEnd);

		clearInterval(mapEditAnimationLoop);
	}

	this.drawEditMap = function() {
		//draw grid
		if (drawMapGrid) {
			ctx.fillStyle = getContrastingColor();
			for (var x = 1; x < roomsize; x++) {
				ctx.fillRect(x * tilesize * scale, 0 * tilesize * scale, 1, roomsize * tilesize * scale);
			}
			for (var y = 1; y < roomsize; y++) {
				ctx.fillRect(0 * tilesize * scale, y * tilesize * scale, roomsize * tilesize * scale, 1);
			}
		}

		//draw walls
		if (drawCollisionMap) {
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
			controls.settings.palette.appendChild(paletteSelect.GetElement());
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

	/* play control */
	controls.playToggle.onclick = function(e) {
		// todo : move these methods into room tool
		if (e.target.checked) {
			on_play_mode();
		}
		else {
			on_edit_mode();
		}

		updatePlayModeButton();
	};

	/* name input */
	controls.nameInput.onchange = function(e) {
		var str = e.target.value;

		if (str.length > 0) {
			room[curRoom].name = str;
		}
		else {
			room[curRoom].name = null;
		}

		updateNamesFromCurData()

		refreshGameData();

		events.Raise("change_room_name", { id: curRoom, name: room[curRoom].name });
	};

	/* nav controls */
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
			self.drawEditMap();
			paintTool.UpdateCanvas();
		}
	}

	controls.nav.prev.onclick = prevRoom;
	controls.nav.next.onclick = nextRoom;
	controls.nav.add.onclick = newRoom;
	controls.nav.copy.onclick = duplicateRoom;
	controls.nav.del.onclick = deleteRoom;

	/* tool select controls */
	controls.toolSelect.paint.onclick = function() {
		curEditTool = EditTool.Paint;
	};

	controls.toolSelect.erase.onclick = function() {
		curEditTool = EditTool.Erase;
	};

	controls.toolSelect.select.onclick = function() {
		curEditTool = EditTool.Select;
	};

	/* visibility controls */
	controls.visibility.toggle.onclick = function(e) {
		controls.visibility.container.style.display = e.target.checked ? "block" : "none";
	};

	controls.visibility.gridVisibility.onclick = function(e) {
		drawMapGrid = e.target.checked;
		iconUtils.LoadIcon(controls.visibility.gridIcon, drawMapGrid ? "visibility" : "visibility_off");
		this.drawEditMap();
	};

	controls.visibility.wallVisibility.onclick = function(e) {
		drawCollisionMap = e.target.checked;
		iconUtils.LoadIcon(controls.visibility.wallIcon, drawCollisionMap ? "visibility" : "visibility_off");
		this.drawEditMap();
	};

	controls.visibility.exitAndEndingVisibility.onclick = function(e) {
		// TODO
	};

	/* settings controls */
	controls.settings.toggle.onclick = function(e) {
		controls.settings.container.style.display = e.target.checked ? "block" : "none";
	};

	/* event listeners */
	events.Listen("select_room", function(e) {
		selectRoom(e.id);
	});
} // RoomTool()

// TODO : refactor this global function
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


// todo :
// TODO : move THIS into paint.js
function editDrawingAtCoordinate(x,y) {
	// todo: need more consistency with these methods
	// TODO : also... need to make sure this works in edit mode now
	var spriteId = getSpriteAt(x,y).id;

	if (spriteId) {
		if(spriteId === "A") {
			on_paint_avatar_ui_update();
		}
		else {
			on_paint_sprite_ui_update();
		}

		paintTool.SelectDrawing(spriteId);
		// paintExplorer.RefreshAndChangeSelection(spriteId);

		return;
	}

	var item = getItem(curRoom,x,y);
	if (item) {
		on_paint_item_ui_update(); // TODO : move these things into paint.js

		paintTool.SelectDrawing(item.id);
		// paintExplorer.RefreshAndChangeSelection(item.id);

		return;
	}

	var tileId = getTile(x,y);
	if(tileId != 0) {
		on_paint_tile_ui_update();

		paintTool.SelectDrawing(tileId);
		// paintExplorer.RefreshAndChangeSelection(tileId);

		return;
	}
}