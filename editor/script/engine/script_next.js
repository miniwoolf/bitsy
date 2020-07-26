/*
TODO
X try hooking up to dialogue buffer
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

this.HasScript = function(scriptId) {
	return (scriptId in compiledScripts);
}

this.Compile = function(scriptId, script) {
	var tokens = tokenize(script);
	var expressions = parse(tokens);
	compiledScripts[scriptId] = expressions[0];
}

// TODO : pass in dialog buffer instead of using a global reference?
this.Run = function(scriptId, objectContext) {
	var lib = createLibrary(dialogBuffer, objectContext);
	eval(compiledScripts[scriptId], new Environment(lib));
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

function eval(expression, environment) {
	if (expression.type === "number" || expression.type === "string" || expression.type === "boolean") {
		return expression.value;
	}
	else if (expression.type === "symbol") {
		return environment.Get(expression.value);
	}
	else if (expression.type === "list") {
		if (expression.list[0].value in special) {
			return special[expression.list[0].value](expression, environment);
		}
		else {
			var listValues = expression.list.map(function (x) { return eval(x, environment); });
			if (listValues[0] instanceof Function) {
				var result = listValues[0].apply(null, listValues.slice(1));
				return result;
			}
			// else: then what??
		}
	}
}

// not sure yet how I want to design the environment
// TODO : should I allow library methods to be overwritten by the user?
// TODO : global vars vs local vars? need back compat with globals..
function Environment(localEnvironment, parent) {
	this.Has = function(symbol) {
		return symbol in localEnvironment;
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
		localEnvironment[symbol] = value;
	};
}

var special = {
	"->": function(expression, environment) {
		var result = null;

		for (var i = 1; i < expression.list.length; i++) {
			if (expression.list[i].type === "string") {
				console.log("add-text " + expression.list[i].value);
				// TODO : is using "say" the way to do this?
				// or should I access the buffer directly?
				environment.Get("say")(expression.list[i].value);
				result = null;
			}
			else if (expression.list[i].type != "list") {
				console.log("add-word " + expression.list[i].value);
				// hacky... need to expose AddWord
				environment.Get("say")(" " + expression.list[i].value);
				result = null;
			}
			else {
				result = eval(expression.list[i], environment);
			}
		}

		return result;
	},
	"seq": function(expression, environment) {
		if ("index" in expression) {
			expression.index = Math.min(expression.index + 1, expression.list.length - 1);
		}
		else {
			expression.index = 1;
		}

		return eval(expression.list[expression.index], environment);
	},
	"cyc": function(expression, environment) {
		if ("index" in expression) {
			expression.index = Math.max(1, (expression.index + 1) % expression.list.length);
		}
		else {
			expression.index = 1;
		}

		return eval(expression.list[expression.index], environment);
	},
	"shf": function(expression, environment) {
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

		return eval(expression.list[expression.shuffle[expression.index]], environment);
	},
	"if": function(expression, environment) {
		var result = null;

		for (var i = 1; i < expression.list.length; i += 2) {
			if (i + 1 >= expression.list.length) {
				result = eval(expression.list[i], environment);
				break;
			}
			else if (eval(expression.list[i])) {
				result = eval(expression.list[i + 1], environment);
				break;
			}
		}

		return result;
	},
	"fn": function(expression, environment) {
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

		return function() {
			// create local function environment from input parameters
			var parameters = {};
			for (var i in arguments) {
				if (i < parameterNames.length) {
					parameters[parameterNames[i]] = arguments[i];
				}
			}
			var fnEnvironment = new Environment(parameters, environment);

			// every expression after the parameter list is a statement in the function
			var result = null;
			for (var i = 2; i < expression.list.length; i++) {
				result = eval(expression.list[i], fnEnvironment);
			}

			return result;
		};
	},
}

function createLibrary(dialogBuffer, objectContext) {
	var library = {
		/* dialogue functions */
		"say": function(str) {
			// todo : is this the right implementation of say?
			// todo : hacky to force into a string with concatenation?
			dialogBuffer.AddText("" + str);
		},
		"br": function() {
			dialogBuffer.AddLinebreak();
		},
		"pg": function() {
			// TODO : fix this method...
			dialogBuffer.AddPagebreak();
		},
		"wvy": function() {
			dialogBuffer.AddTextEffect("wvy");
		},
		"/wvy": function() {
			dialogBuffer.RemoveTextEffect("wvy");
		},
		"shk": function() {
			dialogBuffer.AddTextEffect("shk");
		},
		"/shk": function() {
			dialogBuffer.RemoveTextEffect("shk");
		},
		"rbw": function() {
			dialogBuffer.AddTextEffect("rbw");
		},
		"/rbw": function() {
			dialogBuffer.RemoveTextEffect("rbw");
		},
		"clr": function(index) {
			dialogBuffer.AddTextEffect("clr", [index]);
		},
		"/clr": function() {
			dialogBuffer.RemoveTextEffect("clr");
		},

		/* TODO: missing old functions
			- end
			- exit
			- item
			- printX
			- property
			- set (=)
			- math operators
		*/

		/* math functions */
		"==": function(a, b) {
			return a == b;
		},
		">": function(a, b) {
			return a > b;
		},
		"<": function(a, b) {
			return a < b;
		},
		">=": function(a, b) {
			return a >= b;
		},
		"<=": function(a, b) {
			return a <= b;
		},
		// TODO : should these allow multiple arguments?
		"*": function(a, b) {
			return a * b;
		},
		"/": function(a, b) {
			return a / b;
		},
		"+": function(a, b) {
			return a + b;
		},
		"-": function(a, b) {
			return a - b;
		},

		// NEW FUNCTIONS (WIP)
		"step": function(spaces, direction) {
			// TODO : check collisions!!
			if (objectContext != null && objectContext != undefined) {
				if (direction === "left") {
					objectContext.x -= spaces;
				}
				else if (direction === "right") {
					objectContext.x += spaces;
				}
				else if (direction === "up") {
					objectContext.y -= spaces;
				}
				else if (direction === "down") {
					objectContext.y += spaces;
				}
			}
			// TODO : return true/false if successful
		},
		"destroy": function() {
			// TODO : actually remove from room (after object merge)
			if (objectContext != null && objectContext != undefined) {
				objectContext.room = null;
			}
		},
	};

	return library;
}

} // ScriptNext