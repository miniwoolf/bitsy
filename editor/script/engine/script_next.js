/*
NOTES
- BUG: when scripts take too long they interrupt player keypresses!
- should the compile then run model remain the same?
- name of language / module?
- missing functions
- better multi-line dialog script parsing by handling strings inside quotes
- what do I do about global vs local variables?
- decide whether the new style names are good
- global variables aren't working
*/

var SymNext = {
	CurlyOpen : "{",
	CurlyClose : "}",
	DialogStart : "->",
	Entry : ":",
};

function ScriptNext() {

var compiledScripts = {};

function compile(script) {
	var scriptStr = script.src;
	if (scriptStr.indexOf("\n") < 0) {
		// wrap one-line dialogs in a dialog expression
		// TODO : is this still what I want?
		scriptStr = SymNext.CurlyOpen + SymNext.DialogStart + " " + scriptStr + SymNext.CurlyClose;
	}

	var tokens = tokenize(scriptStr);
	var expressions = parse(tokens);
	compiledScripts[script.id] = expressions[0];

	return compiledScripts[script.id];
}
this.Compile = compile;

// TODO : pass in dialog buffer instead of using a global reference?
this.Run = function(script, instance, callback) {
	if (!(script.id in compiledScripts)) {
		compile(script);
	}

	var globalEnv = createGlobalEnvironment(variable);
	var coreLibrary = createCoreLibrary(globalEnv);
	var dialogLibrary = createDialogLibrary(dialogBuffer, coreLibrary);
	var spriteLibrary = createSpriteLibrary(instance, dialogLibrary);
	var mathLibrary = createMathLibrary(spriteLibrary);
	var instanceEnv = createInstanceEnvironment(instance, mathLibrary);

	eval(compiledScripts[script.id], instanceEnv, callback);
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

var indentStep = 4;

function serializeSingle(expressionList, indentDepth) {
	var out = "";

	for (var i = 0; i < expressionList.length; i++) {
		if (i > 0) {
			out += " ";
		}

		out += serialize(expressionList[i], indentDepth + indentStep); // todo : need the increase in indent?
	}

	return out;
}

function serializeMulti(expressionList, indentDepth, startBreakIndex) {
	if (startBreakIndex === undefined || startBreakIndex === null) {
		startBreakIndex = 0;
	}

	var out = "";

	for (var i = 0; i < expressionList.length; i++) {
		if (i > startBreakIndex) {
			out += "\n" + (" ".repeat(indentDepth + indentStep));
		}
		else if (i > 0) {
			out += " ";
		}

		out += serialize(expressionList[i], indentDepth + indentStep);
	}

	return out;
}

function serializeAlternating(expressionList, indentDepth) {
	var out = "";

	for (var i = 0; i < expressionList.length; i++) {
		var isChoiceResult = i > 0 && (i - 1) % 2 != 0;
		var indentNext = indentDepth + indentStep + (isChoiceResult ? indentStep : 0);

		if (i > 0) {
			out += "\n" + (" ".repeat(indentNext));
		}

		out += serialize(expressionList[i], indentNext);
	}

	return out;
}

function serializePaired(expressionList, indentDepth) {
	var out = "";

	for (var i = 0; i < expressionList.length; i++) {
		if (i > 0 && (i - 1) % 2 === 0) {
			out += "\n" + (" ".repeat(indentDepth + indentStep));
		}
		else if (i > 0) {
			out += " ";
		}

		out += serialize(expressionList[i], indentDepth + indentStep);
	}

	return out;	
}

// todo : should "SAY" be inline? "PG"?
function isInlineFunction(symbol) {
	return ["BR", "PG", "WVY", "/WVY", "SHK", "/SHK", "RBW", "/RBW", "CLR", "/CLR"].indexOf(symbol) != -1;
}
this.IsInlineFunction = isInlineFunction;

var wordWrapLen = 32; // hard coded to match default bitsy font -- make it more flexible later?

function serializeWrapped(expressionList, indentDepth) {
	var indentNext = 0;

	if (indentDepth != undefined && indentDepth != null) {
		indentNext = indentDepth + indentStep;
	}

	var out = "";

	var curLineLen = 0;
	var prevLineIsMultiLine = false;

	for (var i = 0; i < expressionList.length; i++) {
		var exp = expressionList[i];
		var expStr = serialize(expressionList[i], indentNext);
		var nextWordLen = exp.type != "list" && exp.value != SymNext.DialogStart ? expStr.length : 0;
		var isMultiLine = exp.type === "list" && !isInlineFunction(exp.list[0].value);

		if (prevLineIsMultiLine || isMultiLine || (curLineLen + nextWordLen + 1) > wordWrapLen) {
			out += "\n" + (" ".repeat(indentNext));
			curLineLen = 0;
		}
		else if (i > 0) {
			out += " ";
			curLineLen++;
		}

		prevLineIsMultiLine = isMultiLine;
		curLineLen += nextWordLen;

		out += expStr;
	}

	return out;
}
this.SerializeWrapped = serializeWrapped;

function isDialogExpression(symbol) {
	return symbol === SymNext.DialogStart;
}
this.IsDialogExpression = isDialogExpression;

function isSequence(symbol) {
	return ["SEQ", "CYC", "SHF"].indexOf(symbol) != -1;
}
this.IsSequence = isSequence;

function isChoice(symbol) {
	return symbol === "PIK";
}
this.IsChoice = isChoice;

function isConditional(symbol) {
	return symbol === "IF";
}
this.IsConditional = isConditional;

function isTable(symbol) {
	return symbol === "TBL";
}
this.IsTable = isTable;

function isFunctionDefinition(symbol) {
	return symbol === "FN";
}
this.IsFunctionDefinition = isFunctionDefinition;

// todo : nicer formatting for asignment to multiline lists?
function serializeList(expression, indentDepth) {
	var listType = null;
	if (expression.list.length > 0 && expression.list[0].type === "symbol") {
		listType = expression.list[0].value;
	}

	var out = SymNext.CurlyOpen;

	if (isDialogExpression(listType)) {
		out += serializeWrapped(expression.list, indentDepth);
	}
	else if (isSequence(listType)) {
		out += serializeMulti(expression.list, indentDepth);
	}
	else if (isChoice(listType)) {
		out += serializeAlternating(expression.list, indentDepth);
	}
	else if (isConditional(listType) || isTable(listType)) {
		out += serializePaired(expression.list, indentDepth);
	}
	else if (isFunctionDefinition(listType)) {
		out += serializeMulti(expression.list, indentDepth, 1);
	}
	else {
		out += serializeSingle(expression.list, indentDepth);
	}

	if (out.indexOf("\n") != -1) {
		out += "\n" + (" ".repeat(indentDepth));
	}

	out += SymNext.CurlyClose;

	return out;
}

function serializeAtom(value, type) {
	var out = "";

	if (type === "number") {
		out = "" + value;
	}
	else if (type === "string") {
		out = '"' + value + '"';
	}
	else if (type === "boolean") {
		out = value ? "YES" : "NO";
	}
	else if (type === "symbol") {
		out = value;
	}

	return out;
}
this.SerializeValue = serializeAtom;

function serialize(expression, indentDepth) {
	if (indentDepth === undefined || indentDepth === null) {
		indentDepth = 0;
	}

	var out = "";

	if (expression.type === "list") {
		out = serializeList(expression, indentDepth);
	}
	else {
		out = serializeAtom(expression.value, expression.type);
	}

	return out;
}
this.Serialize = serialize;

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
	else if (token === "YES") {
		return {
			type: "boolean",
			value: true,
		};
	}
	else if (token === "NO") {
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
this.ParseValue = function(valueStr) { return parseAtom(valueStr).value; };

function parse(tokens, list) {
	if (list === undefined || list === null) {
		list = [];
	}

	while (tokens.length > 0) {
		var token = tokens.shift();
		if (token === SymNext.CurlyOpen) {
			list.push({
				type: "list",
				list: parse(tokens),
			});
		}
		else if (token === SymNext.CurlyClose) {
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
// TODO : it also would need a special case for the SymNext.DialogStart operator

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

var special = {
	"SEQ": function(expression, environment, onReturn) {
		if ("index" in expression) {
			expression.index = Math.min(expression.index + 1, expression.list.length - 1);
		}
		else {
			expression.index = 1;
		}

		eval(expression.list[expression.index], environment, onReturn);
	},
	"CYC": function(expression, environment, onReturn) {
		if ("index" in expression) {
			expression.index = Math.max(1, (expression.index + 1) % expression.list.length);
		}
		else {
			expression.index = 1;
		}

		eval(expression.list[expression.index], environment, onReturn);
	},
	"SHF": function(expression, environment, onReturn) {
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
	"PIK" : function(expression, environment, onReturn) {
		var i = 1;
		var evalNext;

		var buffer = environment.Get("DIALOG_BUFFER", true);

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

				if (buffer) {
					buffer.AddChoiceOption(handler);
				}

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
	"IF": function(expression, environment, onReturn) {
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
	// todo : more creative name for functions? rename to routine? RN? RTN?
	"FN": function(expression, environment, onReturn) {
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
			var fnEnvironment = new Table(environment);
			for (var i = 0; i < parameters.length; i++) {
				if (i < parameterNames.length) {
					fnEnvironment.Set(parameterNames[i], parameters[i]);
				}
			}

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
	// todo : name? LET instead?
	"SET": function(expression, environment, onReturn) {
		// todo : assumes the right number of list elements, etc.
		eval(expression.list[2], environment, function(value) {
			// todo : what about local variables?
			environment.SetGlobal(expression.list[1].value, value);
			onReturn(null);
		});
	},
	"TBL": function(expression, environment, onReturn) {
		var struct = {}; // todo : replace with more robust data structure
		var i = 1;
		var evalNext;

		evalNext = function() {
			if (i >= expression.list.length) {
				onReturn(struct);
			}
			else {
				// todo : store special symbols like @ and -> somewhere?
				if (expression.list[i].type === "symbol" && expression.list[i].value[0] === SymNext.Entry) {
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
}

// hacky?
special[SymNext.DialogStart] = function(expression, environment, onReturn) {
	var result = null;
	var i = 1;
	var evalNext;

	// todo : what if no buffer is available?
	var buffer = environment.Get("DIALOG_BUFFER", true);

	evalNext = function() {
		if (i >= expression.list.length) {
			onReturn(result);
		}
		else {
			if (expression.list[i].type === "string") {
				if (buffer) {
					buffer.AddText(expression.list[i].value);
				}

				result = null;
				i++;
				evalNext();
			}
			else if (expression.list[i].type != "list") {
				if (buffer) {
					buffer.AddWord(serializeAtom(expression.list[i].value, expression.list[i].type));
				}

				result = null;
				i++;
				evalNext();
			}
			else {
				eval(expression.list[i], environment, function(value) { result = value; i++; evalNext(); });
			}
		}
	}

	evalNext();
};

special[SymNext.Entry] = function(expression, environment, onReturn) {
	if (expression.list.length < 3) {
		onReturn(null); // not enough arguments!
	}

	var name = expression.list[2].value;

	eval(expression.list[1], environment, function(obj) {
		// todo : handle null / invalid tables
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
			onReturn(null); // no value!
		}
	});
};

function valueToString(value) {
	var str = "";
	if (typeof value === "function") {
		str += "FN";
	}
	else if (typeof value === "object") {
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
		var location = { id: parameters[0], x: 0, y: 0, };

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

} // ScriptNext

function Table(parent) {
	var entries = {};
	var keyList = []; // maintained in insertion order

	var hasParent = parent != undefined && parent != null;

	var GetInternalKey = function(key, isSecret) {
		return isSecret ? key : SymNext.Entry + key;
	}

	this.Has = function(key, isSecret) {
		var hasEntry = false;
		var internalKey = GetInternalKey(key, isSecret);

		if (entries.hasOwnProperty(internalKey)) {
			hasEntry = true;
		}
		else if (hasParent && parent.Has(key, isSecret)) {
			hasEntry = true;
		}

		return hasEntry;
	}

	this.Get = function(key, isSecret) {
		var value = false;
		var internalKey = GetInternalKey(key, isSecret);

		if (entries.hasOwnProperty(internalKey)) {
			value = entries[internalKey];
		}
		else if (hasParent && parent.Has(key, isSecret)) {
			value = parent.Get(key, isSecret);
		}

		return value;
	}

	function set(key, value, options) {
		var isGlobal = options && options.isGlobal;
		var isSecret = options && options.isSecret;

		var internalKey = GetInternalKey(key, isSecret);
		var hasInternalEntry = entries.hasOwnProperty(internalKey);

		if (!hasInternalEntry && hasParent && (isGlobal || parent.Has(key, isSecret))) {
			parent.Set(key, value, options);
		}
		else {
			if (!isSecret && !hasInternalEntry) {
				keyList.push(key);
			}

			if (!hasInternalEntry) {
				AddGetterSetter(key, internalKey);
			}

			entries[internalKey] = value;
		}

		return value;
	}

	this.Set = set;

	this.SetGlobal = function(key, value) {
		set(key, value, { isGlobal: true });
	}

	this.SetSecret = function(key, value) {
		set(key, value, { isSecret: true });
	}

	// only includes keys for entries that are not secret
	this.Keys = function() {
		return keyList;
	}

	this.ForEach = function(f) {
		for (var i = 0; i < keyList.length; i++) {
			var k = keyList[i];
			var v = entries[GetInternalKey(k)];
			f(v, k);
		}
	}

	// adds external getter and setter for convenience of the engine
	var AddGetterSetter = (function(object) {
		return function(externalKey, internalKey) {
			var getterSetter = {};

			getterSetter[externalKey] = {
				get : function() {
					return entries[internalKey];
				},
				set : function(value) {
					entries[internalKey] = value;
				},
			};

			Object.defineProperties(object, getterSetter);
		};
	})(this);
} // Table