// todo : remove unused environment parameters

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
			return value;
		},
	};

	return env;
}

function createInstanceEnvironment(instance, parent) {
	var env = new Table(parent);

	// todo : name? THIS? SELF? I? something else?
	env.Set("ME", instance);

	return env;
}

function createCoreLibrary(parent) {
	var lib = new Table(parent);

	/* TODO: missing old functions
		- exit (EXT)
		- item (ITM)
	*/

	lib.Set("END", function(parameters, environment, onReturn) {
		// todo very global / hacky?
		isEnding = true;
		isNarrating = true;
		dialogRenderer.SetCentered(true);
		onReturn(null);
	});

	// todo : make sure rooms remember their original pal id and reset to it
	lib.Set("PAL", function(parameters, environment, onReturn) {
		room[curRoom].pal = parameters[0];
		onReturn(null); // todo : replace all nulls with false? return palette id?
	});

	// todo : what about OTHER one parameter math functions? cos? sin? etc...
	// todo : do I want both NOT and ISNT? how do I surface NOT if not thru math editor
	lib.Set("NOT", function(parameters, environment, onReturn) {
		onReturn(!parameters[0]);
	});

	return lib;
}

// todo : is this the right place for this?
function valueToString(value) {
	var str = "";
	if (typeof value === "function") {
		str += "FN";
	}
	else if (value instanceof Table) { // todo : some other way to detect tables??
		// todo : smarter to string for tables later on (include name, id, type, etc)
		str += "TBL";
	}
	else if (typeof value === "boolean") {
		str += value ? "YES" : "NO";
	}
	else {
		str += value;
	}

	return str;
}

function createDialogLibrary(dialogBuffer, parent) {
	var lib = new Table(parent);

	/* todo
		missing old func:
		- printX (DRW) -- correct name?
	*/

	lib.Set("SAY", function(parameters, environment, onReturn) {
		// todo : is this the right implementation of say?
		// todo : hacky to force into a string with concatenation?
		// todo : nicer way to print objects
		// todo : new way to convert bools etc to string
		dialogBuffer.AddText(valueToString(parameters[0]));
		dialogBuffer.AddScriptReturn(onReturn);
	});

	lib.Set("BR", function(parameters, environment, onReturn) {
		dialogBuffer.AddLinebreak();
		dialogBuffer.AddScriptReturn(onReturn);
	});

	lib.Set("PG", function(parameters, environment, onReturn) {
		// TODO : fix this method...
		dialogBuffer.AddPagebreak();
		dialogBuffer.AddScriptReturn(onReturn);
	});

	var textEffectIds = ["WVY", "SHK", "RBW", "CLR", "TFX"];

	function addTextEffect(id) {
		lib.Set(id, function(parameters, environment, onReturn) {
			dialogBuffer.AddTextEffect(id, parameters);
			onReturn(null);
		});

		lib.Set("/" + id, function(parameters, environment, onReturn) {
			dialogBuffer.RemoveTextEffect(id);
			onReturn(null);
		});
	};

	for (var i = 0; i < textEffectIds.length; i++) {
		addTextEffect(textEffectIds[i]);
	}

	// add secret dialog buffer entry for use by dialog expressions & choices
	lib.SetSecret("DIALOG_BUFFER", dialogBuffer);

	return lib;
}

function createSpriteLibrary(contextInstance, parent) {
	var lib = new Table(parent);

	// NEW FUNCTIONS (WIP)

	// create new sprite instance
	lib.Set("PUT", function(parameters, environment, onReturn) {
		var instance = null;

		// todo : what if there's no parameters[0]?
		var location = createObjectLocation(parameters[0], 0, 0);

		if (parameters.length >= 3) {
			location.x = parameters[1];
			location.y = parameters[2];
		}
		else if (contextInstance != undefined && contextInstance != null) {
			// todo : what if the context instance is invalid now?
			location.x = contextInstance.x; // todo : upper?
			location.y = contextInstance.y;
		}

		// todo: rename createObjectInstance
		instance = createObjectInstance(nextObjectInstanceId, location);
		objectInstances[nextObjectInstanceId] = instance;
		nextObjectInstanceId++;

		onReturn(instance);
	});

	// remove sprite instance
	lib.Set("RID", function(parameters, environment, onReturn) {
		// todo : allow deleting the current sprite if no parameters?
		// todo : what if the object passed in is no longer valid?
		if (parameters.length >= 1 && "instanceId" in parameters[0]) {
			delete objectInstances[parameters[0].instanceId];
		}

		onReturn(null);
	});

	// move a sprite instance (with collisions)
	lib.Set("HOP", function(parameters, environment, onReturn) {
		// todo : allow moving the current sprite if no parameters? that would mean putting the reference param last
		var result = false;

		var instance = parameters[0];

		if (instance.id === "A") {
			result = movePlayer(keyNameToDirection(parameters[1]));
		}
		else {
			result = !move(instance, keyNameToDirection(parameters[1])).collision;
		}

		onReturn(result);
	});

	return lib;
}

function createMathLibrary(parent) {
	var lib = new Table(parent);

	lib.Set("IS", function(parameters, environment, onReturn) {
		onReturn(parameters[0] === parameters[1]);
	});

	lib.Set("ISNT", function(parameters, environment, onReturn) {
		onReturn(parameters[0] != parameters[1]);
	});

	lib.Set("GT", function(parameters, environment, onReturn) {
		onReturn(parameters[0] > parameters[1]);
	});

	lib.Set("LT", function(parameters, environment, onReturn) {
		onReturn(parameters[0] < parameters[1]);
	});

	lib.Set("GTE", function(parameters, environment, onReturn) {
		onReturn(parameters[0] >= parameters[1]);
	});

	lib.Set("LTE", function(parameters, environment, onReturn) {
		onReturn(parameters[0] <= parameters[1]);
	});

	// TODO : should these allow multiple arguments?
	// TODO : use math symbols for any of these? > < == * / + -
	lib.Set("MLT", function(parameters, environment, onReturn) {
		onReturn(parameters[0] * parameters[1]);
	});

	lib.Set("DIV", function(parameters, environment, onReturn) {
		onReturn(parameters[0] / parameters[1]);
	});

	lib.Set("ADD", function(parameters, environment, onReturn) {
		onReturn(parameters[0] + parameters[1]);
	});

	// todo : potentially using "SUB" instead "-" frees up "-" to be the dialog start symbal
	lib.Set("SUB", function(parameters, environment, onReturn) {
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
	var spriteLibrary = createSpriteLibrary(instance, dialogLibrary);
	var mathLibrary = createMathLibrary(spriteLibrary);
	var instanceEnv = createInstanceEnvironment(instance, mathLibrary);

	return instanceEnv;
};
	
}