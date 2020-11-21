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

	var isMouseDown = false;

	var drawingId = "A";
	events.Listen("select_drawing", function(event) {
		drawingId = event.id;
	});

	// render flags
	var drawMapGrid = true;
	var drawCollisionMap = false;

	var selectPos = null;
	var selectCornerAnimationTimer = 0;
	var selectCornerOffset = 1;

	function onMouseDown(e) {
		isMouseDown = true;

		e.preventDefault();

		var off = getOffset(e);
		off = mobileOffsetCorrection(off, e, (tilesize * roomsize *scale));
		var x = Math.floor( off.x / (tilesize*scale) );
		var y = Math.floor( off.y / (tilesize*scale) );

		if (onSelectBehavior != null) {
			onSelectBehavior.OnSelect(curRoom, x, y);
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
				events.Raise("change_room", { id: curRoom });
			}
		}
		else if (curEditTool === EditTool.Erase) {
			room[curRoom].tilemap[y][x] = "0";
			removeAllSpritesAtLocation(curRoom, x, y);
			refreshGameData();
			self.drawEditMap();
			events.Raise("change_room", { id: curRoom });
		}
		else if (curEditTool === EditTool.Select) {
			if (selectPos != null && selectPos.x === x && selectPos.y === y) {
				selectPos = null;
			}
			else {
				var selectId = null;

				var locations = getAllSpritesAtLocation(curRoom, x, y);

				if (locations.length > 0) {
					selectId = locations[locations.length - 1].id;
				}
				else if (room[curRoom].tilemap[y][x] != "0") {
					selectId = room[curRoom].tilemap[y][x];
				}

				if (selectId != null) {
					events.Raise("select_drawing", { id: selectId });
				}

				selectPos = { x:x, y:y };
			}
		}
	}

	function onMouseMove(e) {
		if (isMouseDown) {
			if (onSelectBehavior != null) {
				return;
			}

			onDragEdit(e);
		}
	}

	function onMouseUp(e) {
		if (isMouseDown) {
			if (onSelectBehavior != null) {
				return;
			}

			onDragEdit(e);

			isMouseDown = false;
		}
	}

	function onDragEdit(e) {
		var off = getOffset(e);
		off = mobileOffsetCorrection(off, e, (tilesize * roomsize * scale));
		var x = clamp(Math.floor(off.x / (tilesize*scale)), 0, roomsize - 1);
		var y = clamp(Math.floor(off.y / (tilesize*scale)), 0, roomsize - 1);

		if (curEditTool === EditTool.Paint && tile[drawingId].type === TYPE_KEY.TILE) {
			room[curRoom].tilemap[y][x] = drawingId;
			refreshGameData();
			self.drawEditMap();
			events.Raise("change_room", { id: curRoom });
		}
		else if (curEditTool === EditTool.Erase) {
			room[curRoom].tilemap[y][x] = "0";
			removeAllSpritesAtLocation(curRoom, x, y);
			refreshGameData();
			self.drawEditMap();
			events.Raise("change_room", { id: curRoom });
		}
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

			selectCornerAnimationTimer += deltaTime;

			if (selectCornerAnimationTimer >= 400) {
				selectCornerOffset = (selectCornerOffset === 1) ? 2 : 1;
				selectCornerAnimationTimer = 0
			}

			self.drawEditMap();
		}, 16);
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

		// draw select cursor
		if (selectPos != null) {
			ctx.fillStyle = getContrastingColor();

			var size = tilesize * scale;
			var top = (selectPos.y * size) - (selectCornerOffset * scale);
			var left = (selectPos.x * size) - (selectCornerOffset * scale);
			var bottom = (selectPos.y * size) + size + ((selectCornerOffset - 1) * scale);
			var right = (selectPos.x * size) + size + ((selectCornerOffset - 1) * scale);

			// top left
			ctx.fillRect(left, top, scale, scale);
			ctx.fillRect(left, top + scale, scale, scale);
			ctx.fillRect(left + scale, top, scale, scale);

			// top right
			ctx.fillRect(right, top, scale, scale);
			ctx.fillRect(right, top + scale, scale, scale);
			ctx.fillRect(right - scale, top, scale, scale);

			// bottom left
			ctx.fillRect(left, bottom, scale, scale);
			ctx.fillRect(left, bottom - scale, scale, scale);
			ctx.fillRect(left + scale, bottom, scale, scale);

			// bottom right
			ctx.fillRect(right, bottom, scale, scale);
			ctx.fillRect(right, bottom - scale, scale, scale);
			ctx.fillRect(right - scale, bottom, scale, scale);
		}
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
		updateRoomName();
	}

	var onSelectBehavior = null;
	this.OnSelectLocation = function(onSelect, onFinish, options) {
		controls.nav.container.style.display = "none";
		controls.locationSelect.container.style.display = "flex";

		controls.toolSelect.select.checked = true;
		curEditTool = EditTool.Select;

		if (onSelectBehavior != null) {
			onSelectBehavior.OnFinish();
		}

		onSelectBehavior = {
			OnSelect : function(curRoom, x, y) {
				selectPos = { x:x, y:y, };
				onSelect(curRoom, x, y);
			},
			OnFinish : function() {
				onFinish();

				onSelectBehavior = null;
				selectPos = null;

				controls.nav.container.style.display = "flex";
				controls.locationSelect.container.style.display = "none";
			}
		};

		if (options && options.startPos) {
			selectPos = options.startPos;
		}
		else {
			selectPos = null;
		}

		if (options && options.message) {
			controls.locationSelect.message.innerText = options.message;
		}
		else {
			controls.locationSelect.message.innerText = "click in room";
		}

		return onSelectBehavior;
	}

	controls.locationSelect.stop.onclick = function() {
		if (onSelectBehavior) {
			onSelectBehavior.OnFinish();
		}
	};

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
		var ids = sortedIdList(room);
		var nextIndex = (roomIndex + 1) % ids.length;
		var nextId = ids[nextIndex];

		events.Raise("select_room", { id: nextId });
	}

	function prevRoom() {
		var ids = sortedIdList(room);
		var prevIndex = roomIndex - 1;
		if (prevIndex < 0) {
			prevIndex = (ids.length - 1);
		}
		var prevId = ids[prevIndex];

		events.Raise("select_room", { id: prevId });
	}

	function duplicateRoom() {
		var idList = sortedIdList(room);
		var copyRoomId = idList[roomIndex];
		var roomToCopy = room[copyRoomId];

		var newRoomId = nextB256Id(room, 1, DEFAULT_REGISTRY_SIZE);

		if (newRoomId != null) {
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
		else {
			alert("oh no you ran out of rooms! :(");
		}
	}

	function newRoom() {
		var roomId = nextB256Id(room, 1, DEFAULT_REGISTRY_SIZE);

		if (roomId != null) {
			var palIdList = sortedIdList(palette);
			var palId = palIdList.length > 0 ? palIdList[0] : null;

			room[roomId] = createRoom(roomId, palId);
			refreshGameData();

			events.Raise("add_room", { id: roomId });
			events.Raise("select_room", { id: roomId });
		}
		else {
			alert("oh no you ran out of rooms! :(");
		}
	}

	function deleteRoom() {
		if ( Object.keys(room).length <= 1 ) {
			alert("You can't delete your only room!");
		}
		else if ( confirm("Are you sure you want to delete this room? You can't get it back.") ) {
			var roomId = sortedIdList(room)[roomIndex];

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

	function updateRoomName() {
		if (curRoom == null) { 
			return;
		}

		// document.getElementById("roomId").innerHTML = curRoom;
		var roomLabel = localization.GetStringOrFallback("room_label", "room");
		document.getElementById("roomName").placeholder =
			roomLabel + " " + curRoom + " (" + fromB256(curRoom) + "/" + (DEFAULT_REGISTRY_SIZE - 1) + ")";

		if(room[curRoom].name != null) {
			document.getElementById("roomName").value = room[curRoom].name;
		}
		else {
			document.getElementById("roomName").value = "";
		}
	}

	/* tool select controls */
	controls.toolSelect.paint.onclick = function() {
		if (onSelectBehavior) {
			onSelectBehavior.OnFinish();
		}

		curEditTool = EditTool.Paint;
	};
	controls.toolSelect.paint.checked = true;

	controls.toolSelect.erase.onclick = function() {
		if (onSelectBehavior) {
			onSelectBehavior.OnFinish();
		}

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
		self.drawEditMap();
	};

	controls.visibility.wallVisibility.onclick = function(e) {
		drawCollisionMap = e.target.checked;
		iconUtils.LoadIcon(controls.visibility.wallIcon, drawCollisionMap ? "visibility" : "visibility_off");
		self.drawEditMap();
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
		if (onSelectBehavior) {
			onSelectBehavior.OnFinish();
		}

		selectPos = null;

		selectRoom(e.id);
	});
} // RoomTool()

// TODO : refactor this global function
function selectRoom(roomId) {
	// ok watch out this is gonna be hacky
	var ids = sortedIdList(room);

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
	}
}