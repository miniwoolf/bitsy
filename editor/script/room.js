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

	var drawingId = "A";

	// edit flags
	var isDragAddingTiles = false;
	var isDragDeletingTiles = false;

	// render flags
	this.drawMapGrid = true;
	this.drawCollisionMap = false;
	this.areMarkersVisible = false;

	this.markers = null;

	var isDisabledExternally = false;
	events.Listen("disable_room_tool", function() {
		isDisabledExternally = true;
	});
	events.Listen("enable_room_tool", function() {
		isDisabledExternally = false;
	});

	function getDrawingType() {
		return getDrawingTypeFromId(drawingId);
	}

	function onMouseDown(e) {
		e.preventDefault();

		var isDisabledTemp = isDisabledExternally; // hack to exit early if disabled at START of mouse down

		var off = getOffset(e);
		off = mobileOffsetCorrection(off,e,(tilesize*mapsize*scale));
		var x = Math.floor( off.x / (tilesize*scale) );
		var y = Math.floor( off.y / (tilesize*scale) );
		// console.log(x + " " + y);

		events.Raise("click_room", { roomId : curRoom, x : x, y : y });

		if (isDisabledTemp) {
			return;
		}

		if( self.editDrawingAtCoordinateCallback != null && e.altKey ) {
			self.editDrawingAtCoordinateCallback(x,y); // "eye dropper"
			return;
		}

		var isEditingMarker = false;

		if (self.areMarkersVisible) {
			if (self.markers.IsPlacingMarker()) {
				self.markers.PlaceMarker(x,y);
				self.drawEditMap();
				isEditingMarker = true;
			}
			else if (self.markers.TrySelectMarkerAtLocation(x,y)) {
				self.markers.StartDrag(x,y);
				self.drawEditMap();
				isEditingMarker = true;
			}
		}

		if (!isEditingMarker && drawingId != null) {
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
			else {
				// TODO : is this the final behavior I want?

				var otherObject = getObjectLocation(curRoom, x, y);
				var isObjectAlreadyHere = otherObject != null && otherObject.id === drawingId;

				if (otherObject) {
					var index = getRoom().objectLocations.indexOf(otherObject);
					getRoom().objectLocations.splice(index, 1);
				}

				if (!isObjectAlreadyHere) {
					getRoom().objectLocations.push(createObjectLocation(drawingId, x, y));
				}
			}

			refreshGameData();
			self.drawEditMap();
		}
	}

	function onMouseMove(e) {
		if (isDisabledExternally) {
			return;
		}

		if (self.markers.GetSelectedMarker() != null && self.markers.IsDraggingMarker()) {
			// drag marker around
			var off = getOffset(e);
			off = mobileOffsetCorrection(off,e,(tilesize*mapsize*scale));
			var x = Math.floor(off.x / (tilesize*scale));
			var y = Math.floor(off.y / (tilesize*scale));

			self.markers.ContinueDrag(x,y);
			self.drawEditMap();
		}
		else {
			editTilesOnDrag(e);
		}
	}

	function onMouseUp(e) {
		if (isDisabledExternally) {
			return;
		}

		editTilesOnDrag(e);
		isDragAddingTiles = false;
		isDragDeletingTiles = false;

		self.markers.EndDrag();
	}

	function editTilesOnDrag(e) {
		var off = getOffset(e);
		off = mobileOffsetCorrection(off,e,(tilesize*mapsize*scale));
		var x = clamp(Math.floor(off.x / (tilesize*scale)), 0, mapsize - 1);
		var y = clamp(Math.floor(off.y / (tilesize*scale)), 0, mapsize - 1);
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

		mapEditAnimationLoop =
			setInterval( function() {
				if (!isPlayMode) {
					animationCounter = animationTime + 1; // hack
					updateAnimation();
					self.drawEditMap();
				}
				else {
					console.log("BLINKY BUG :(");
					self.unlistenEditEvents(); // hacky attempt to prevent blinky bug (not sure what the real cause is)
				}
			}, animationTime ); // update animation in map mode
	}

	this.unlistenEditEvents = function() {
		canvas.removeEventListener("mousedown", onMouseDown);
		canvas.removeEventListener("mousemove", onMouseMove);
		canvas.removeEventListener("mouseup", onMouseUp);
		canvas.removeEventListener("mouseleave", onMouseUp);
		canvas.removeEventListener("touchstart", onTouchStart);
		canvas.removeEventListener("touchmove", onTouchMove);
		canvas.removeEventListener("touchend", onTouchEnd);

		clearInterval( mapEditAnimationLoop );
	}

	this.drawEditMap = function() {
		//clear screen
		ctx.fillStyle = "rgb("+getPal(curPal())[0][0]+","+getPal(curPal())[0][1]+","+getPal(curPal())[0][2]+")";
		ctx.fillRect(0,0,canvas.width,canvas.height);

		//draw map
		drawRoom(room[curRoom], { drawObjectInstances: false });

		//draw grid
		if (self.drawMapGrid) {
			ctx.fillStyle = getContrastingColor();
			for (var x = 1; x < mapsize; x++) {
				ctx.fillRect(x*tilesize*scale,0*tilesize*scale,1,mapsize*tilesize*scale);
			}
			for (var y = 1; y < mapsize; y++) {
				ctx.fillRect(0*tilesize*scale,y*tilesize*scale,mapsize*tilesize*scale,1);
			}
		}

		//draw walls
		if (self.drawCollisionMap) {
			ctx.fillStyle = getContrastingColor();
			for (y in room[curRoom].tilemap) {
				for (x in room[curRoom].tilemap[y]) {
					if( isWall(x,y,curRoom) ) {
						ctx.fillRect(x*tilesize*scale,y*tilesize*scale,tilesize*scale,tilesize*scale);
					}
				}
			}
		}

		//draw exits (and entrances) and endings
		if (self.areMarkersVisible) {
			var w = tilesize * scale;
			var markerList = self.markers.GetMarkerList();

			for (var i = 0; i < markerList.length; i++) {
				var marker = markerList[i]; // todo name
				marker.Draw(ctx,curRoom,w,self.markers.GetSelectedMarker() == marker);
			}

			ctx.globalAlpha = 1;
		}
	}

	events.Listen("palette_change", function(event) {
		self.drawEditMap();
	});
} // RoomTool()

/* METHODS */
function togglePlayMode(e) {
	if (e.target.checked) {
		on_play_mode();
	}
	else {
		on_edit_mode();
	}

	updatePlayModeButton();
}
/* TODO 
- make a PlayModeController objec?
- share:
	- on_play_mode
	- on_edit_mode
*/