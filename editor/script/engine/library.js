function Library() {

// todo : extend table so this doesn't have to be custom?
function createGlobalEnvironment(variableStore) {
	var env = {
		Has: function(key) {
			return variableStore.hasOwnProperty(key);
		},
		Get: function(key) {
			if (variableStore.hasOwnProperty(key)) {
				return variableStore[key];
			}

			return false;
		},
		Set: function(key, value) {
			variableStore[key] = value;

			if (onVariableChanged) {
				onVariableChanged(key);
			}

			return value;
		},
	};

	return env;
}

function createInstanceEnvironment(instance, parent) {
	var env = new Table(parent);
	env.Set(ENTRY_KEY.THIS_SPRITE, instance);
	return env;
}

function createCoreLibrary(parent) {
	var lib = new Table(parent);

	// todo : allow name as input
	lib.Set("ITM", function(parameters, onReturn) {
		var itemId = parameters[0];

		var curItemCount = player().inventory[itemId] ? player().inventory[itemId] : 0;

		if (parameters.length > 1) {
			// TODO : is it a good idea to force inventory to be >= 0?
			player().inventory[itemId] = Math.max(0, parseInt(parameters[1]));
			curItemCount = player().inventory[itemId];

			if (onInventoryChanged != null) {
				onInventoryChanged(itemId);
			}
		}

		onReturn(curItemCount);
	});

	return lib;
}

// TODO : do I want these? what should the final version be?
function coreLibWIP(parent) {
	// todo : what about OTHER one parameter math functions? cos? sin? etc...
	// todo : do I want both NOT and ISNT? how do I surface NOT if not thru math editor
	lib.Set("NOT", function(parameters, onReturn) {
		onReturn(!parameters[0]);
	});

	// WIP --- for loops, range, and random for tables
	// todo :
	// should I also have NTH and LEN? or have them instead?
	// if keys are strings... they can't be used to update the table!
	// other ideas: NK == nth key, NV == nth value
	lib.Set("FOR", function(parameters, onReturn) {
		// todo : verify the inputs are correct
		var table = parameters[0];
		var fn = parameters[1];

		var keys = table.Keys();
		var i = 0;
		var evalNext;

		evalNext = function() {
			if (i >= keys.length) {
				onReturn(false);
			}
			else {
				var k = keys[i];
				var v = table.Get(k);

				fn([v, k], function() {
					i++;
					evalNext();
				});
			}
		};

		evalNext();
	});

	// todo : should max be inclusive or exclusive? look at other langs
	lib.Set("RNG", function(parameters, onReturn) {
		var min = parameters[0];
		var max = parameters[1];
		var index = 0;
		var table = new Table();

		for (var i = min; i < max; i++) {
			table.Set("" + index, i);
			index++;
		}

		onReturn(table);
	});

	lib.Set("RND", function(parameters, onReturn) {
		var table = parameters[0];
		var keys = table.Keys();
		var k = keys[Math.floor(Math.random() * keys.length)];
		onReturn(table.Get(k));
	});
}

// todo : is this the right place for this?
function valueToString(value) {
	var str = "";

	console.log(typeof value);

	if (typeof value === "function") {
		str += SYM_KEY.FUNCTION;
	}
	else if (IsATable(value)) {
		if (value.Has(ENTRY_KEY.SPRITE_NAME)) {
			str += valueToString(value.Get(ENTRY_KEY.SPRITE_NAME));
		}
		else if (value.Has(ENTRY_KEY.SPRITE_TYPE) && value.Has(ENTRY_KEY.SPRITE_ID)) {
			str += valueToString(value.Get(ENTRY_KEY.SPRITE_TYPE)) + " " + valueToString(value.Get(ENTRY_KEY.SPRITE_ID));
		}
		else {
			str += SYM_KEY.TABLE;
		}
	}
	else if ((typeof value === "boolean") || value === undefined || value === null) {
		str += (value ? BOOL_KEY.YES : BOOL_KEY.NO);
	}
	else if ((typeof value === "string") || (typeof value === "number")) {
		str += value;
	}
	else {
		str += BOOL_KEY.NO;
	}

	return str;
}

function createDialogLibrary(dialogBuffer, parent) {
	var lib = new Table(parent);

	lib.Set("SAY", function(parameters, onReturn) {
		// todo : is this the right implementation of say?
		// todo : hacky to force into a string with concatenation?
		// todo : nicer way to print tables
		// todo : new way to convert bools etc to string
		dialogBuffer.AddText(valueToString(parameters[0]));
		dialogBuffer.AddScriptReturn(onReturn);
	});

	// todo : should it be the drawing ID or tile ID?
	lib.Set("DRW", function(parameters, onReturn) {
		dialogBuffer.AddDrawing(parameters[0]);
		dialogBuffer.AddScriptReturn(onReturn);
	});

	lib.Set("BR", function(parameters, onReturn) {
		dialogBuffer.AddLinebreak();
		dialogBuffer.AddScriptReturn(onReturn);
	});

	lib.Set("PG", function(parameters, onReturn) {
		// TODO : fix this method...
		dialogBuffer.AddPagebreak();
		dialogBuffer.AddScriptReturn(onReturn);
	});

	var textEffectIds = ["WVY", "SHK", "RBW", "CLR", "FXT"];

	function addTextEffect(id) {
		lib.Set(id, function(parameters, onReturn) {
			dialogBuffer.AddTextEffect(id, parameters);
			onReturn(false);
		});

		lib.Set("/" + id, function(parameters, onReturn) {
			dialogBuffer.RemoveTextEffect(id);
			onReturn(false);
		});
	};

	for (var i = 0; i < textEffectIds.length; i++) {
		addTextEffect(textEffectIds[i]);
	}

	// add secret dialog buffer entry for use by dialog expressions & choices
	lib.SetSecret("DIALOG_BUFFER", dialogBuffer);

	return lib;
}

function createRoomLibrary(dialogBuffer, dialogRenderer, parent) {
	var lib = new Table(parent);

	lib.Set("PAL", function(parameters, onReturn) {
		var palId = parameters[0];

		// todo -- should there be a helper function that combines these three functions?
		color.LoadRoomPalette(palette[palId]);
		color.UpdateSystemPalette();
		renderer.ResetRenderCache();

		onReturn(false); // todo : return palette id?
	});

	// todo : allow names instead of IDs
	lib.Set("EXT", function(parameters, onReturn) {
		var destRoom = parameters[0];
		var destX = parseInt(parameters[1]);
		var destY = parseInt(parameters[2]);
		var transitionEffect = parameters.length >= 4 ? parameters[3] : null;
		var waitForInput = parameters.length >= 5 ? parameters[4] : true;

		function beginExit() {
			// todo : share some of this logic with regular exits?
			if (transitionEffect != null) {
				transition.BeginTransition(
					player().room,
					player().x,
					player().y,
					destRoom,
					destX,
					destY,
					transitionEffect,
					initRoom);

				transition.UpdateTransition(0);
			}
			else {
				initRoom(destRoom);
			}

			player().room = destRoom;
			player().x = destX;
			player().y = destY;
			curRoom = destRoom;

			// TODO : this doesn't play nice with pagebreak because it thinks the dialog is finished!
			if (transition.IsTransitionActive()) {
				transition.OnTransitionComplete(function() { onReturn(false); });
			}
			else {
				onReturn(false);
			}
		}

		if (waitForInput && dialogBuffer) {
			dialogBuffer.AddPagebreak();
			dialogBuffer.AddScriptReturn(beginExit);
		}
		else {
			beginExit();
		}
	});

	lib.Set("END", function(parameters, onReturn) {
		var waitForInput = parameters.length >= 1 ? parameters[0] : true;

		function beginEnding() {
			// todo very global / hacky?
			isEnding = true;
			isNarrating = true;
			dialogRenderer.SetCentered(true);

			onReturn(false);
		}

		if (waitForInput) {
			dialogBuffer.AddPagebreak();
			dialogBuffer.AddScriptReturn(beginEnding);
		}
		else {
			beginEnding();
		}
	});

	return lib;
}

function createSpriteLibrary(contextInstance, parent) {
	var lib = new Table(parent);

	// NEW FUNCTIONS (WIP)

	// create new sprite instance
	lib.Set("PUT", function(parameters, onReturn) {
		var instance = null;

		// todo : what if there's no parameters[0]?
		var location = createSpriteLocation(parameters[0], 0, 0);

		if (parameters.length >= 3) {
			location.x = parameters[1];
			location.y = parameters[2];
		}
		else if (contextInstance != undefined && contextInstance != null) {
			// todo : what if the context instance is invalid now?
			location.x = contextInstance.x; // todo : upper?
			location.y = contextInstance.y;
		}

		instance = createSpriteInstance(nextInstanceId, location);
		spriteInstances[nextInstanceId] = instance;
		nextInstanceId++;

		onReturn(instance);
	});

	// remove sprite instance
	lib.Set("RID", function(parameters, onReturn) {
		// todo : allow deleting the current sprite if no parameters?
		// todo : what if the sprite passed in is no longer valid?
		if (parameters.length >= 1 && "instanceId" in parameters[0]) {
			delete spriteInstances[parameters[0].instanceId];
		}

		onReturn(false);
	});

	// move a sprite instance (with collisions)
	lib.Set("HOP", function(parameters, onReturn) {
		// todo : allow moving the current sprite if no parameters? that would mean putting the reference param last
		// todo : check that the instance is a valid object instance!
		var instance = parameters[0];
		var result = !move(instance, parameters[1]).collision;

		onReturn(result);
	});

	return lib;
}

function createMathLibrary(parent) {
	var lib = new Table(parent);

	lib.Set("IS", function(parameters, onReturn) {
		onReturn(parameters[0] === parameters[1]);
	});

	lib.Set("ISNT", function(parameters, onReturn) {
		onReturn(parameters[0] != parameters[1]);
	});

	lib.Set("GT", function(parameters, onReturn) {
		onReturn(parameters[0] > parameters[1]);
	});

	lib.Set("LT", function(parameters, onReturn) {
		onReturn(parameters[0] < parameters[1]);
	});

	lib.Set("GTE", function(parameters, onReturn) {
		onReturn(parameters[0] >= parameters[1]);
	});

	lib.Set("LTE", function(parameters, onReturn) {
		onReturn(parameters[0] <= parameters[1]);
	});

	// TODO : should these allow multiple arguments?
	// TODO : use math symbols for any of these? > < == * / + -
	lib.Set("MLT", function(parameters, onReturn) {
		onReturn(parameters[0] * parameters[1]);
	});

	lib.Set("DIV", function(parameters, onReturn) {
		onReturn(parameters[0] / parameters[1]);
	});

	lib.Set("ADD", function(parameters, onReturn) {
		onReturn(parameters[0] + parameters[1]);
	});

	// todo : potentially using "SUB" instead "-" frees up "-" to be the dialog start symbal
	lib.Set("SUB", function(parameters, onReturn) {
		onReturn(parameters[0] - parameters[1]);
	});

	return lib;
}

// todo : is this a good way to do this?
this.IsMathExpression = (function() {
	var mathLibKeys = createMathLibrary().Keys();
	return function(symbol) {
		return mathLibKeys.indexOf(symbol) != -1;
	};
})();

this.CreateScriptEnvironment = function(variable, dialogBuffer, instance) {
	var globalEnv = createGlobalEnvironment(variable);
	var coreLibrary = createCoreLibrary(globalEnv);
	var dialogLibrary = createDialogLibrary(dialogBuffer, coreLibrary);
	var roomLibrary = createRoomLibrary(dialogBuffer, dialogRenderer, dialogLibrary);
	var spriteLibrary = createSpriteLibrary(instance, roomLibrary);
	var mathLibrary = createMathLibrary(spriteLibrary); // todo : why is this one last?
	var instanceEnv = createInstanceEnvironment(instance, mathLibrary);

	return instanceEnv;
};

}