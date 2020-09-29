/*
NOTES
- what's the right id for collisions scripts? CLD? HIT? other?
- BUG: when scripts take too long they interrupt player keypresses!
- should the compile then run model remain the same?
- name of language / module?
- missing functions
- are the short names for sequences good or bad?
- better multi-line dialog script parsing by handling strings inside quotes
- what should the event ids be?
	- three letter? STP, KEY, etc.
	- or four letters? STEP, KEYD, etc.
- should I re-implement infix operations for math?
- what do I do about global vs local variables?
*/

function ScriptNext() {

var compiledScripts = {};

function Parse(script) {
	var scriptStr = script.src;
	if (scriptStr.indexOf("\n") < 0) {
		// wrap one-line dialogs in a dialog expression
		// TODO : is this still what I want?
		scriptStr = "{-> " + scriptStr + "}";
	}

	var tokens = tokenize(scriptStr);
	var expressions = parse(tokens);
	compiledScripts[script.id] = expressions[0];

	return compiledScripts[script.id];
}
this.Parse = Parse;

// TODO : pass in dialog buffer instead of using a global reference?
this.Run = function(script, objectContext, callback) {
	if (!(script.id in compiledScripts)) {
		Parse(script);
	}

	var coreLibrary = createLibrary(dialogBuffer, objectContext);
	// todo : make this environment chaining less awkward?
	var libraryEnv = new Environment(coreLibrary);
	var variableEnv = new Environment(variable, libraryEnv);
	// todo : avatar? or player? for global avatar access
	var objectEnv = new Environment({ this: objectContext, avatar: player(), }, variableEnv);
	eval(compiledScripts[script.id], objectEnv, callback);
}

var RunCallback = function(script, objectContext, inputParameters, callback) {
	this.Run(script, objectContext, function(result) {
		if (result instanceof Function) {
			// TODO : pass in an environment?
			result(inputParameters, null, callback);
		}
		else {
			callback(result);
		}
	});
}
this.RunCallback = RunCallback;

// do I want a monolithic reset function like this?
this.Reset = function() {
	compiledScripts = {};
}

function tokenize(script) {
	// store string literals and replace them with special token
	var stringPattern = /"[\s\S]*?"/g;
	var stringLiterals = script.match(stringPattern);
	script = script.replace(stringPattern, " __string_literal__ ");

	// tokenize on whitespace
	var tokens = script
		.replace(/{/g, " { ")
		.replace(/}/g, " } ")
		.trim()
		.split(/\s+/); // split on whitespace

	// restore string literals
	var stringIndex = 0;
	for (var i = 0; i < tokens.length; i++) {
		if (tokens[i] === "__string_literal__") {
			tokens[i] = stringLiterals[stringIndex];
			stringIndex++;
		}
	}

	return tokens;
}

function parseAtom(token) {
	if (!isNaN(parseFloat(token))) {
		return {
			type: "number",
			value: parseFloat(token),
		};
	}
	else if (token[0] === "\"" && token[token.length - 1] === "\"") {
		return {
			type: "string",
			value: token.substring(1, token.length - 1),
		};
	}
	else if (token === "true") {
		return {
			type: "boolean",
			value: true,
		};
	}
	else if (token === "false") {
		return {
			type: "boolean",
			value: false,
		};
	}
	else {
		return {
			type: "symbol",
			value: token,
		};
	}
}

// todo : hacky handling of strings here...
this.ParseValue = function(valueStr) { return parseAtom(valueStr).value; }

function parse(tokens, list) {
	if (list === undefined || list === null) {
		list = [];
	}

	while (tokens.length > 0) {
		var token = tokens.shift();
		if (token === "{") {
			list.push({
				type: "list",
				list: parse(tokens),
			});
		}
		else if (token === "}") {
			break;
		}
		else {
			list.push(parseAtom(token));
		}
	}

	return list;
}

// TODO : consider using this generalized method?
// function evalList(expression, environment, startIndex, onIncrement, onNext, onLast) {
// 	var i = startIndex;
// 	var evalNext;
//
// 	evalNext = function() {
// 		if (i >= expression.list.length) {
// 			onLast();
// 		}
// 		else {
// 			eval(expression.list[i], environment, function(value) {
// 				onNext(value);
// 				i = onIncrement(i);
// 				evalNext();
// 			});
// 		}
// 	}
//
// 	evalNext();
// }
//
// TODO : example of how this would be used:
// var values = [];
// evalList(expression, environment,
// 	0,
// 	function(i) { return i + 1; },
// 	function(value) { values.push(value); },
// 	function() {
// 		if (values[0] instanceof Function) {
// 			values[0](values.slice(1), environment, onReturn);
// 		}
// 		// else: then what?
// 	});
//
// TODO : it also would need a special case for the "->" operator

function evalList(expression, environment, onReturn) {
	var i = 0;
	var values = [];
	var evalNext;

	evalNext = function() {
		if (i >= expression.list.length) {
			if (values[0] instanceof Function) {
				values[0](values.slice(1), environment, onReturn);
			}
			// else: then what?
		}
		else {
			eval(expression.list[i], environment, function(value) {
				values.push(value);
				i++;
				evalNext();
			});
		}
	}

	evalNext();
}

function eval(expression, environment, onReturn) {
	if (expression.type === "number" || expression.type === "string" || expression.type === "boolean") {
		onReturn(expression.value);
	}
	else if (expression.type === "symbol") {
		onReturn(environment.Get(expression.value));
	}
	else if (expression.type === "list") {
		if (expression.list[0].value in special) {
			special[expression.list[0].value](expression, environment, onReturn);
		}
		else {
			evalList(expression, environment, onReturn);
		}
	}
}

// not sure yet how I want to design the environment
// TODO : should I allow library methods to be overwritten by the user?
// TODO : global vars vs local vars? need back compat with globals..
function Environment(localEnvironment, parent) {
	this.Has = function(symbol) {
		// todo : break up line?
		return (symbol in localEnvironment) || (parent != undefined && parent != null && parent.Has(symbol));
	};

	this.Get = function(symbol) {
		if (symbol in localEnvironment) {
			return localEnvironment[symbol];
		}
		else if (parent != undefined && parent != null && parent.Has(symbol)) {
			return parent.Get(symbol);
		}
		else {
			return null;
		}
	};

	this.Set = function(symbol, value) {
		if (!(symbol in localEnvironment) && parent != undefined && parent != null && parent.Has(symbol)) {
			parent.Set(symbol, value);
		}
		else {
			localEnvironment[symbol] = value;
		}
	};
}

var special = {
	"->": function(expression, environment, onReturn) {
		var result = null;
		var i = 1;
		var evalNext;

		evalNext = function() {
			if (i >= expression.list.length) {
				onReturn(result);
			}
			else {
				if (expression.list[i].type === "string") {
					// TODO : clean up... get rid of null environment? codify how to access "secret" environment methods
					environment.Get(" _add_text_")(
						[expression.list[i].value],
						null,
						function(value) { result = null; i++; evalNext(); });
				}
				else if (expression.list[i].type != "list") {
					environment.Get(" _add_word_")(
						["" + expression.list[i].value],
						null,
						function(value) { result = null; i++; evalNext(); });
				}
				else {
					eval(expression.list[i], environment, function(value) { result = value; i++; evalNext(); });
				}
			}
		}

		evalNext();
	},
	"seq": function(expression, environment, onReturn) {
		if ("index" in expression) {
			expression.index = Math.min(expression.index + 1, expression.list.length - 1);
		}
		else {
			expression.index = 1;
		}

		eval(expression.list[expression.index], environment, onReturn);
	},
	"cyc": function(expression, environment, onReturn) {
		if ("index" in expression) {
			expression.index = Math.max(1, (expression.index + 1) % expression.list.length);
		}
		else {
			expression.index = 1;
		}

		eval(expression.list[expression.index], environment, onReturn);
	},
	"shf": function(expression, environment, onReturn) {
		if (("index" in expression) && (expression.index + 1 < expression.shuffle.length)) {
			expression.index++;
		}
		else {
			expression.index = 0;
			expression.shuffle = [];

			var unshuffled = Array(expression.list.length - 1).fill(1).map((x, y) => x + y);
			while (unshuffled.length > 0) {
				var i = Math.floor(Math.random() * unshuffled.length);
				expression.shuffle.push(unshuffled.splice(i, 1)[0]);
			}
		}

		eval(expression.list[expression.shuffle[expression.index]], environment, onReturn);
	},
	// TODO : correct name for choice selector?
	"cho" : function(expression, environment, onReturn) {
		var i = 1;
		var evalNext;

		// use this to capture the current expression
		function createReturnHandler(expression, environment, onReturn) {
			return function() {
				eval(expression, environment, onReturn);
			}
		}

		evalNext = function() {
			if (i + 1 < expression.list.length) {
				// initialize choice that will evaluate the option result
				var handler = createReturnHandler(expression.list[i + 1], environment, onReturn);
				environment.Get(" _add_choice_")([], environment, handler);

				// eval option (will create the choice text)
				eval(expression.list[i], environment, function() {
					i += 2;
					evalNext();
				});
			}
			else {
				// todo : need to do anything here???
			}
		};

		evalNext();
	},
	"if": function(expression, environment, onReturn) {
		var result = null;
		var i = 1;
		var evalNext;

		evalNext = function() {
			if (i >= expression.list.length) {
				onReturn(null);
			}
			else if (i + 1 >= expression.list.length) {
				eval(expression.list[i], environment, onReturn);
			}
			else {
				eval(expression.list[i], environment, function(value) {
					if (value === true) {
						eval(expression.list[i + 1], environment, onReturn);
					}
					else {
						i += 2;
						evalNext();
					}
				});
			}
		}

		evalNext();
	},
	"fn": function(expression, environment, onReturn) {
		// initialize parameter names
		var parameterNames = [];
		if (expression.list.length >= 2 && expression.list[1].type === "list") {
			var parameterList = expression.list[1];
			for (var i = 0; i < parameterList.list.length; i++) {
				if (parameterList.list[i].type === "symbol") {
					parameterNames.push(parameterList.list[i].value);
				}
			}
		}

		// TODO : do we really need to pass the environment into functions?
		var result = function(parameters, hackDoWeReallyNeededEnvironment, onReturn) {
			// create local function environment from input parameters
			var parameterMap = {};
			for (var i = 0; i < parameters.length; i++) {
				if (i < parameterNames.length) {
					parameterMap[parameterNames[i]] = parameters[i];
				}
			}
			var fnEnvironment = new Environment(parameterMap, environment);

			// every expression after the parameter list is a statement in the function
			var result = null;
			var i = 2;
			var evalNext;

			evalNext = function() {
				if (i >= expression.list.length) {
					onReturn(result);
				}
				else {
					eval(expression.list[i], fnEnvironment, function(value) {
						result = value;
						i++;
						evalNext();
					});
				}
			}

			evalNext();
		};

		onReturn(result);
	},
	// TODO : should this be in special, or core library?
	"=": function(expression, environment, onReturn) {
		// todo : assumes the right number of list elements, etc.
		eval(expression.list[2], environment, function(value) {
			environment.Set(expression.list[1].value, value);
			onReturn(null);
		});
	},
	// TODO : name? object? struct? table? other?
	"struct": function(expression, environment, onReturn) {
		var struct = {};
		var i = 1;
		var evalNext;

		evalNext = function() {
			if (i >= expression.list.length) {
				onReturn(struct);
			}
			else {
				if (expression.list[i].type === "symbol" && expression.list[i].value[0] === ".") {
					var name = expression.list[i].value.slice(1);
					i++;

					// TODO : what if there's an out-of-index error?
					eval(expression.list[i], environment, function(value) {
						struct[name] = value;
						i++;
						evalNext();
					});
				}
				else {
					// for now, skip invalid syntax
					// TODO : decide whether to allow a lua-like "list" form
					i++;
					evalNext();
				}
			}
		}

		evalNext();
	},
	".": function(expression, environment, onReturn) {
		if (expression.list.length < 3) {
			onReturn(null); // not enough arguments!
		}

		var name = expression.list[2].value;

		eval(expression.list[1], environment, function(obj) {
			// todo : handle null / invalid objects
			if (expression.list.length >= 4) {
				eval(expression.list[3], environment, function(value) {
					obj[name] = value;
					onReturn(value);
				});
			}
			else if (name in obj) {
				onReturn(obj[name]);
			}
			else {
				onReturn(null); // no property value!
			}
		});
	},
}

// TODO : refactor to remove environment? doesn't seem like I'm using it...
function createLibrary(dialogBuffer, objectContext) {
	var library = {
		/* dialogue functions */
		"say": function(parameters, environment, onReturn) {
			// todo : is this the right implementation of say?
			// todo : hacky to force into a string with concatenation?
			// todo : nicer way to print objects
			dialogBuffer.AddText("" + parameters[0]);
			dialogBuffer.AddScriptReturn(onReturn);
		},
		"br": function(parameters, environment, onReturn) {
			dialogBuffer.AddLinebreak();
			dialogBuffer.AddScriptReturn(onReturn);
		},
		"pg": function(parameters, environment, onReturn) {
			// TODO : fix this method...
			dialogBuffer.AddPagebreak();
			dialogBuffer.AddScriptReturn(onReturn);
		},
		"wvy": function(parameters, environment, onReturn) {
			dialogBuffer.AddTextEffect("wvy");
			onReturn(null);
		},
		"/wvy": function(parameters, environment, onReturn) {
			dialogBuffer.RemoveTextEffect("wvy");
			onReturn(null);
		},
		"shk": function(parameters, environment, onReturn) {
			dialogBuffer.AddTextEffect("shk");
			onReturn(null);
		},
		"/shk": function(parameters, environment, onReturn) {
			dialogBuffer.RemoveTextEffect("shk");
			onReturn(null);
		},
		"rbw": function(parameters, environment, onReturn) {
			dialogBuffer.AddTextEffect("rbw");
			onReturn(null);
		},
		"/rbw": function(parameters, environment, onReturn) {
			dialogBuffer.RemoveTextEffect("rbw");
			onReturn(null);
		},
		"clr": function(parameters, environment, onReturn) {
			dialogBuffer.AddTextEffect("clr", parameters);
			onReturn(null);
		},
		"/clr": function(parameters, environment, onReturn) {
			dialogBuffer.RemoveTextEffect("clr");
			onReturn(null);
		},

		/* TODO: missing old functions
			- exit
			- item
			- printX
		*/
		"end": function(parameters, environment, onReturn) {
			// todo very global / hacky?
			isEnding = true;
			isNarrating = true;
			dialogRenderer.SetCentered(true);
			onReturn(null);
		},

		/* math functions */
		"==": function(parameters, environment, onReturn) {
			onReturn(parameters[0] === parameters[1]);
		},
		">": function(parameters, environment, onReturn) {
			onReturn(parameters[0] > parameters[1]);
		},
		"<": function(parameters, environment, onReturn) {
			onReturn(parameters[0] < parameters[1]);
		},
		">=": function(parameters, environment, onReturn) {
			onReturn(parameters[0] >= parameters[1]);
		},
		"<=": function(parameters, environment, onReturn) {
			onReturn(parameters[0] <= parameters[1]);
		},
		// TODO : should these allow multiple arguments?
		"*": function(parameters, environment, onReturn) {
			onReturn(parameters[0] * parameters[1]);
		},
		"/": function(parameters, environment, onReturn) {
			onReturn(parameters[0] / parameters[1]);
		},
		"+": function(parameters, environment, onReturn) {
			onReturn(parameters[0] + parameters[1]);
		},
		"-": function(parameters, environment, onReturn) {
			onReturn(parameters[0] - parameters[1]);
		},

		// NEW FUNCTIONS (WIP)
		// todo : other names?
		"step": function(parameters, environment, onReturn) {
			var result = false;

			if (objectContext != null && objectContext != undefined) {
				// todo : make this line a little more readable
				// todo : player vs everything else is hacky?
				if (objectContext.id === "A") {
					result = movePlayer(keyNameToDirection(parameters[0]));
				}
				else {
					result = !move(objectContext, keyNameToDirection(parameters[0])).collision;
				}
			}

			onReturn(result);
		},
		"create": function(parameters, environment, onReturn) {
			var obj = null;

			// TODO : allow user to specify coordinates
			// TODO : what if there's no id? or user uses name instead?
			if (objectContext != null && objectContext != undefined) {
				var objLocation = { id: parameters[0], x: objectContext.x, y: objectContext.y };

				if (parameters.length >= 3) {
					objLocation.x = parameters[1];
					objLocation.y = parameters[2];
				}

				obj = createObjectInstance(nextObjectInstanceId, objLocation);
				objectInstances[nextObjectInstanceId] = obj;

				nextObjectInstanceId++;
			}

			onReturn(obj);
		},
		"destroy": function(parameters, environment, onReturn) {
			// todo : what if the object passed in is no longer valid?
			if (parameters.length >= 1 && "instanceId" in parameters[0]) {
				delete objectInstances[parameters[0].instanceId];
			}

			onReturn(null);
		},

		// todo : how do I want to handle lists?
		"list" : function(parameters, environment, onReturn) {
			onReturn(parameters);
		},

		// prototype of custom text effects
		//todo: is "tfx" the acronym I want to use?
		"tfx": function(parameters, environment, onReturn) {
			dialogBuffer.AddTextEffect("tfx", parameters);
			onReturn(null);
		},
		"/tfx": function(parameters, environment, onReturn) {
			dialogBuffer.RemoveTextEffect("tfx");
			onReturn(null);
		},

		// secret dialog buffer methods (todo: maybe they shouldn't be secret?)
		" _add_word_": function(parameters, environment, onReturn) {
			dialogBuffer.AddWord(parameters[0]);
			dialogBuffer.AddScriptReturn(onReturn);
		},
		// this one is kind of a duplicate of "say" isn't it?
		" _add_text_": function(parameters, environment, onReturn) {
			dialogBuffer.AddText(parameters[0]);
			dialogBuffer.AddScriptReturn(onReturn);
		},
		// todo: name?
		" _add_choice_": function(parameters, environment, onReturn) {
			dialogBuffer.AddChoiceOption(onReturn);
		},
	};

	return library;
}

} // ScriptNext